import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { fulfillOrderStock } from "@/lib/orders/stock";
import { sendOrderConfirmationEmail } from "@/lib/email";

export type MercadoPagoPayment = {
  id: number;
  status: string;
  external_reference: string | null;
  payer?: { email?: string };
};

export type ReconcileOutcome =
  | "no_order"
  | "already_paid"
  | "payment_id_recorded"
  | "paid";

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
    columns: { id: true, status: true, order_number: true, total: true, customer_snapshot: true },
    where: eq(orders.id, orderId),
  });
  if (!order) return "no_order";

  if (PAID_STATUSES.has(order.status)) return "already_paid";

  if (payment.status !== "approved") {
    await db.update(orders).set({ payment_id: String(payment.id) }).where(eq(orders.id, orderId));
    return "payment_id_recorded";
  }

  await db
    .update(orders)
    .set({ status: "paid", payment_id: String(payment.id) })
    .where(eq(orders.id, orderId));

  try {
    await fulfillOrderStock(orderId);
  } catch (error) {
    console.error("[mercadopago] baixa de estoque falhou", error);
  }

  const snapshot = order.customer_snapshot;
  const email = snapshot?.email ?? payment.payer?.email;
  if (email) {
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
