"use server";

import { count, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/guards";
import {
  getCartVariants,
  reviseCartItems,
  type CartVariantOption,
  type ReviseCartResult,
} from "@/lib/data/checkout";
import { getCustomerForUser } from "@/lib/data/customers";
import { getDb, schema } from "@/lib/db";
import { insertChunks, runBatch } from "@/lib/db/batch";
import { nextOrderNumber } from "@/lib/db/sequences";
import { addressSchema } from "@/lib/validations/address";
import {
  getPaymentProvider,
  resolvePaymentMethod,
  type PaymentInitResult,
} from "@/lib/payments";
import { getSiteSettings } from "@/lib/data/settings";
import { priceOrder } from "@/lib/orders/pricing";
import { getSalesMode } from "@/lib/sales-mode";
import { isCheckoutMethod, type CheckoutMethod } from "@/lib/constants";

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
  /** Where the shopper chose to finish paying. Omitted means "whatever the
   * store is configured for", which is how this behaved before the choice
   * existed. */
  method?: CheckoutMethod;
  couponCode?: string;
  items: { variantId: string; qty: number }[];
};

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNumber: number; payment: PaymentInitResult | null }
  | {
      ok: false;
      message: string;
      /** The coupon no longer applies (expired, out of uses, under its
       * minimum…): the checkout drops it so the shopper can retry. */
      couponRejected?: boolean;
    };

export async function createOrderAction(
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  // The page redirects while the checkout is closed (lib/sales-mode.ts);
  // this is the same rule for a call that skips the page.
  const sales = await getSalesMode(await getSiteSettings());
  if (!sales.checkoutOpen) {
    return { ok: false, message: "Finalize a compra pela sacola: o pedido segue pelo WhatsApp." };
  }

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

  // The same pricing as the WhatsApp order (lib/orders/pricing.ts). The
  // coupon is re-checked against the database subtotal — what the bag
  // showed was only a preview. A coupon that stopped applying in between
  // is an error, not a silent discount of zero: the shopper would
  // otherwise pay more than the total they confirmed.
  const priced = await priceOrder(subtotal, input.couponCode);
  if (!priced.ok) {
    return { ok: false, couponRejected: true, message: `Cupom removido: ${priced.message}` };
  }
  const { discount, couponCode, shippingMode, shipping, total } = priced.pricing;

  // Resolved before the insert so the row records the route the order
  // actually took, not the route that was asked for — the two differ when
  // the store has no online checkout configured.
  const paymentMethod = resolvePaymentMethod(
    isCheckoutMethod(input.method) ? input.method : undefined,
    sales.mercadoPagoActive,
  );

  // Online payment takes the whole bill at once, and a freight still to be
  // agreed isn't in it yet. Until the checkout quotes Melhor Envio, only a
  // free freight can be paid here.
  if (paymentMethod === "mercadopago" && shippingMode === "to_agree") {
    return {
      ok: false,
      message: "O frete desta compra é combinado pelo WhatsApp. Escolha finalizar no WhatsApp.",
    };
  }

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
          shipping_mode: shippingMode,
          discount,
          total,
          coupon_code: couponCode,
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
      // No coupon use yet: it counts when the order is paid
      // (lib/coupons/usage.ts), so an abandoned payment spends nothing.
    ]);
    orderNumber = (created as { order_number: number }[])[0].order_number;
  } catch (error) {
    console.error("[createOrderAction]", error);
    return { ok: false, message: "Não foi possível criar o pedido." };
  }

  try {
    const provider = getPaymentProvider(
      isCheckoutMethod(input.method) ? input.method : undefined,
      sales.mercadoPagoActive,
    );
    const payment = await provider.createPayment({
      orderId,
      orderNumber,
      subtotal,
      shipping,
      shippingMode,
      discount,
      couponCode,
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
