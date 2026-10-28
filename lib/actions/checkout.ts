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
import { quoteFreight } from "@/lib/shipping/quote";
import type { ShippingQuote } from "@/lib/shipping/melhor-envio";
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

export type CheckoutFreightResult =
  | { ok: true; quotes: ShippingQuote[] }
  | { ok: false; message: string };

/**
 * The checkout's Frete step: Melhor Envio options for the bag as the
 * database has it (prices and stock re-read) and the address's CEP. The
 * prices here are the carrier's; the free-shipping rule is applied on top
 * (freightCharge), the same way the server charges the order.
 */
export async function quoteCheckoutFreightAction(
  cep: string,
  items: { variantId: string; qty: number }[],
): Promise<CheckoutFreightResult> {
  const sales = await getSalesMode(await getSiteSettings());
  if (!sales.checkoutOpen) return { ok: false, message: "Frete indisponível no momento." };
  const revision = await reviseCartItems(items.slice(0, 50));
  if (revision.items.length === 0) {
    return { ok: false, message: "Sua sacola está vazia ou os itens não estão mais disponíveis." };
  }
  const result = await quoteFreight(
    cep,
    revision.items.map((item) => ({ productId: item.productId, quantity: item.availableQty })),
  );
  return result.ok ? { ok: true, quotes: result.quotes } : { ok: false, message: result.error };
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
  /** The Melhor Envio option picked in the Frete step and the price the
   * shopper saw for it. The server quotes again and charges its own
   * number; a different one fails the order with `freightChanged`. */
  freight?: { serviceId: number; expectedPrice: number };
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
      /** The freight option is gone or repriced: the checkout quotes again
       * and the shopper picks again. */
      freightChanged?: boolean;
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

  let customer = await getCustomerForUser(user.id);
  // The store's own admin account (scripts/create-admin.mjs) has no
  // customer row — it never went through the shop's sign-up — and the
  // order and the address both point at one. It gets a bare row on its
  // first purchase, so the owner can test the checkout with the account
  // the panel already knows. A shopper always has one from sign-up.
  if (!customer && user.role === "admin") {
    await getDb()
      .insert(schema.customers)
      .values({ id: user.id, name: user.name || user.email, phone: "", birthdate: "" })
      .onConflictDoNothing();
    customer = await getCustomerForUser(user.id);
  }
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

  // The freight is quoted again here, for the order's own lines and the
  // address being saved — what the Frete step showed was a preview, like
  // the coupon. No option, no order: the checkout always charges freight.
  if (!input.freight) {
    return { ok: false, freightChanged: true, message: "Escolha uma opção de frete." };
  }
  const quote = await quoteFreight(
    addressParsed.data.cep,
    revision.items.map((item) => ({ productId: item.productId, quantity: item.availableQty })),
  );
  if (!quote.ok) {
    return { ok: false, freightChanged: true, message: quote.error };
  }
  const chosenQuote = quote.quotes.find((option) => option.serviceId === input.freight?.serviceId);

  // The same pricing as the WhatsApp order (lib/orders/pricing.ts). The
  // coupon is re-checked against the database subtotal — what the bag
  // showed was only a preview. A coupon that stopped applying in between
  // is an error, not a silent discount of zero: the shopper would
  // otherwise pay more than the total they confirmed. The same goes for a
  // freight that changed price.
  const priced = await priceOrder(subtotal, input.couponCode, {
    options: quote.quotes,
    serviceId: input.freight.serviceId,
    expectedPrice: input.freight.expectedPrice,
  });
  if (!priced.ok) {
    return priced.reason === "freight"
      ? { ok: false, freightChanged: true, message: priced.message }
      : { ok: false, couponRejected: true, message: `Cupom removido: ${priced.message}` };
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
  // agreed isn't in it. The checkout always quotes now, so this is only the
  // backstop for a pricing that ever came back "a combinar".
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
          // The address as typed, plus the freight picked: the order pages
          // and the WhatsApp message say which service and how long.
          shipping_address: {
            ...addressParsed.data,
            freight: chosenQuote
              ? {
                  service_id: chosenQuote.serviceId,
                  name: chosenQuote.name,
                  company: chosenQuote.company,
                  days: chosenQuote.deliveryDays,
                }
              : null,
          },
          // What the label is bought with; the panel suggests it first.
          shipping_service: chosenQuote ? String(chosenQuote.serviceId) : null,
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
