"use server";

import { count, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/guards";
import {
  getCartVariants,
  reviseCartItems,
  type CartVariantOption,
  type ReviseCartResult,
} from "@/lib/data/checkout";
import { validateCoupon } from "@/lib/data/coupons";
import { getCustomerForUser } from "@/lib/data/customers";
import { getDb, schema } from "@/lib/db";
import { insertChunks, runBatch } from "@/lib/db/batch";
import { nextOrderNumber } from "@/lib/db/sequences";
import { roundMoney } from "@/lib/money";
import { addressSchema } from "@/lib/validations/address";
import {
  getPaymentProvider,
  resolvePaymentMethod,
  type PaymentInitResult,
} from "@/lib/payments";
import { getSiteSettings } from "@/lib/data/settings";
import { qualifiesForFreeShipping } from "@/lib/shop-config";
import {
  SHIPPING_METHODS,
  isCheckoutMethod,
  type CheckoutMethod,
  type ShippingMethod,
} from "@/lib/constants";

export async function reviseCartAction(
  items: { variantId: string; qty: number }[],
): Promise<ReviseCartResult> {
  return reviseCartItems(items);
}

/** O que a sacola usa para travar o botão "+" no que existe de verdade. */
export async function getCartVariantsAction(
  productIds: string[],
): Promise<Record<string, CartVariantOption[]>> {
  return getCartVariants(productIds);
}

export type CouponResult =
  | { ok: true; code: string; discount: number }
  | { ok: false; message: string };

export async function applyCouponAction(
  code: string,
  subtotal: number,
): Promise<CouponResult> {
  if (!code.trim()) return { ok: false, message: "Informe um cupom." };

  const coupon = await validateCoupon(code, subtotal);
  if (!coupon) return { ok: false, message: "Cupom inválido ou não aplicável." };

  return { ok: true, code: coupon.code, discount: coupon.discount };
}

export type CreateOrderInput = {
  address: {
    cep: string;
    street: string;
    number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
  };
  shippingMethod: ShippingMethod;
  /** Where the shopper chose to finish paying. Omitted means "whatever the
   * store is configured for", which is how this behaved before the choice
   * existed. */
  method?: CheckoutMethod;
  couponCode?: string;
  items: { variantId: string; qty: number }[];
};

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNumber: number; payment: PaymentInitResult | null }
  | { ok: false; message: string };

export async function createOrderAction(
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, message: "Você precisa entrar para finalizar a compra." };
  }

  const customer = await getCustomerForUser(user.id);
  if (!customer) {
    return { ok: false, message: "Complete seu cadastro antes de continuar." };
  }

  const addressParsed = addressSchema.safeParse({
    ...input.address,
    is_default: false,
  });
  if (!addressParsed.success) {
    return { ok: false, message: "Endereço inválido." };
  }

  // Prices and stock are re-read from the database; the cart is never
  // trusted for money.
  const revision = await reviseCartItems(input.items);
  if (revision.items.length === 0) {
    return {
      ok: false,
      message: "Sua sacola está vazia ou os itens não estão mais disponíveis.",
    };
  }

  const subtotal = revision.subtotal;

  let discount = 0;
  if (input.couponCode) {
    const coupon = await validateCoupon(input.couponCode, subtotal);
    if (coupon) discount = coupon.discount;
  }

  // Resolved before the insert so the row records the route the order
  // actually took, not the route that was asked for — the two differ when
  // the store has no online checkout configured.
  const paymentMethod = resolvePaymentMethod(
    isCheckoutMethod(input.method) ? input.method : undefined,
  );

  const shippingInfo = SHIPPING_METHODS[input.shippingMethod];
  // Same rule the bag's progress bar shows (Configurações → Vitrine).
  const { free_shipping_threshold } = await getSiteSettings();
  const shipping = qualifiesForFreeShipping(subtotal, free_shipping_threshold)
    ? 0
    : shippingInfo.price;
  const total = roundMoney(Math.max(subtotal + shipping - discount, 0));

  const db = getDb();
  const { addresses, orders, order_items } = schema;
  const [{ existing }] = await db
    .select({ existing: count() })
    .from(addresses)
    .where(eq(addresses.customer_id, user.id));

  const orderId = crypto.randomUUID();
  let orderNumber: number;
  try {
    // Address, order and items land together or not at all.
    const [, created] = await runBatch(db, [
      db.insert(addresses).values({
        ...addressParsed.data,
        customer_id: user.id,
        is_default: existing === 0,
      }),
      db
        .insert(orders)
        .values({
          id: orderId,
          order_number: nextOrderNumber,
          customer_id: user.id,
          status: "pending",
          subtotal,
          shipping,
          discount,
          total,
          payment_method: paymentMethod,
          shipping_address: addressParsed.data,
          customer_snapshot: {
            name: customer.name,
            email: user.email,
            phone: customer.phone,
          },
        })
        .returning({ order_number: orders.order_number }),
      ...insertChunks(
        db,
        order_items,
        revision.items.map((item) => ({
          order_id: orderId,
          product_id: item.productId,
          variant_id: item.variantId,
          name: item.name,
          color: item.color,
          size: item.size,
          unit_price: item.price,
          qty: item.availableQty,
        })),
      ),
    ]);
    orderNumber = (created as { order_number: number }[])[0].order_number;
  } catch (error) {
    console.error("[createOrderAction]", error);
    return { ok: false, message: "Não foi possível criar o pedido." };
  }

  try {
    const provider = getPaymentProvider(
      isCheckoutMethod(input.method) ? input.method : undefined,
    );
    const payment = await provider.createPayment({
      orderId,
      orderNumber,
      total,
      customerName: customer.name,
      customerEmail: user.email,
      items: revision.items.map((item) => ({
        name: item.name,
        qty: item.availableQty,
        unitPrice: item.price,
      })),
    });

    return { ok: true, orderId, orderNumber, payment };
  } catch {
    // The order already exists — the shopper can still reach it and pay
    // later (e.g. by re-visiting /pedido/[id]) even if the payment
    // provider call itself failed.
    return { ok: true, orderId, orderNumber, payment: null };
  }
}
