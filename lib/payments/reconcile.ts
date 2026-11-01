import "server-only";
import { and, eq, notInArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { fulfillOrderStock } from "@/lib/orders/stock";
import { runBatch } from "@/lib/db/batch";
import { countCouponUse, isCouponLimitError } from "@/lib/coupons/usage";
import { sendOrderConfirmationEmail } from "@/lib/email";
import {
  buildNewOrderAlert,
  describeMercadoPagoPayment,
} from "@/lib/notifications/new-order";
import { sendTelegramMessage } from "@/lib/notifications/telegram";
import { getRequestOrigin } from "@/lib/site-url";

export type MercadoPagoPayment = {
  id: number;
  status: string;
  external_reference: string | null;
  payer?: { email?: string };
  payment_type_id?: string | null;
  payment_method_id?: string | null;
  installments?: number | null;
};

export type ReconcileOutcome =
  "no_order" | "already_paid" | "payment_id_recorded" | "paid";

const PAID_STATUSES = new Set(["paid", "processing", "shipped", "delivered"]);

/**
 * Applies a Mercado Pago payment (already fetched from their API, never
 * taken from the webhook body) to the order it references.
 *
 * Idempotent: a payment for an order that is already paid is a no-op, and
 * the stock decrement has its own guard (lib/orders/stock.ts), so Mercado
 * Pago resending the same notification changes nothing.
 */
export async function reconcileMercadoPagoPayment(
  payment: MercadoPagoPayment,
): Promise<ReconcileOutcome> {
  const orderId = payment.external_reference;
  if (!orderId) return "no_order";

  const db = getDb();
  const { orders } = schema;
  const order = await db.query.orders.findFirst({
    columns: {
      id: true,
      status: true,
      order_number: true,
      total: true,
      subtotal: true,
      shipping: true,
      shipping_mode: true,
      discount: true,
      coupon_code: true,
      customer_snapshot: true,
      shipping_address: true,
    },
    where: eq(orders.id, orderId),
  });
  if (!order) return "no_order";

  if (PAID_STATUSES.has(order.status)) return "already_paid";

  if (payment.status !== "approved") {
    await db
      .update(orders)
      .set({ payment_id: String(payment.id) })
      .where(eq(orders.id, orderId));
    return "payment_id_recorded";
  }

  // Só passa a "pago" quem ainda não era: com o webhook e a página de
  // retorno chegando juntos, só uma das duas chamadas ganha esta linha, e
  // é ela que segue (estoque, e-mail, aviso) — o aviso não sai em dobro.
  const changed = await db
    .update(orders)
    .set({ status: "paid", payment_id: String(payment.id) })
    .where(
      and(
        eq(orders.id, orderId),
        notInArray(orders.status, [...PAID_STATUSES] as (typeof orders.status._.data)[]),
      ),
    )
    .returning({ id: orders.id });
  if (changed.length === 0) return "already_paid";

  // The coupon use counts with the payment (lib/coupons/usage.ts). The
  // money is already in, so a coupon that hit its limit meanwhile is only
  // logged — refusing the paid order would be worse.
  try {
    await runBatch(db, [...countCouponUse(db, orderId)]);
  } catch (error) {
    if (!isCouponLimitError(error)) throw error;
    console.error("[mercadopago] cupom acima do limite no pedido", orderId);
  }

  try {
    await fulfillOrderStock(orderId);
  } catch (error) {
    console.error("[mercadopago] baixa de estoque falhou", error);
  }

  const items = await db
    .select({
      name: schema.order_items.name,
      color: schema.order_items.color,
      size: schema.order_items.size,
      qty: schema.order_items.qty,
      unit_price: schema.order_items.unit_price,
    })
    .from(schema.order_items)
    .where(eq(schema.order_items.order_id, orderId));

  try {
    await sendTelegramMessage(
      buildNewOrderAlert({
        orderNumber: order.order_number,
        orderId,
        items: items.map((i) => ({
          name: i.name,
          color: i.color,
          size: i.size,
          qty: i.qty,
          unitPrice: i.unit_price,
        })),
        subtotal: order.subtotal,
        shipping: order.shipping,
        shippingMode: order.shipping_mode,
        discount: order.discount,
        couponCode: order.coupon_code,
        total: order.total,
        customer: order.customer_snapshot,
        address: order.shipping_address,
        paymentLabel: describeMercadoPagoPayment(payment),
        origin: (await getRequestOrigin()).replace(/\/+$/, ""),
      }),
    );
  } catch (error) {
    console.error("[mercadopago] aviso de novo pedido falhou", error);
  }

  const snapshot = order.customer_snapshot;
  const email = snapshot?.email ?? payment.payer?.email;
  if (email) {
    await sendOrderConfirmationEmail({
      to: email,
      customerName: snapshot?.name ?? "cliente",
      orderNumber: order.order_number,
      total: order.total,
      items: items.map((i) => ({
        name: i.name,
        color: i.color ?? "",
        size: i.size ?? "",
        qty: i.qty,
        unitPrice: i.unit_price,
      })),
    });
  }

  return "paid";
}
