import "server-only";
import { and, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { runBatch } from "@/lib/db/batch";

const { orders, order_items, product_variants } = schema;

/**
 * Decrements stock for a paid order — transactional and idempotent (was the
 * `fulfill_order_stock` Postgres function). Called when a payment is
 * confirmed: the Mercado Pago webhook, and the admin moving an order to a
 * paid status.
 *
 * `orders.stock_decremented_at` is the guard: every variant UPDATE only
 * applies while it is still null, and the batch's last statement sets it.
 * A repeated call — a webhook retry, paid → processing → shipped — finds
 * it set and changes nothing.
 *
 * Like before, a variant without enough stock is skipped (`stock >= qty`)
 * rather than failing the whole order: the money is already in, and
 * holding the sale back would be worse than an oversell the operator can
 * see on the stock page.
 */
export async function fulfillOrderStock(orderId: string): Promise<void> {
  const db = getDb();
  const [order, items] = await db.batch([
    db.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId)),
    db
      .select({ variant_id: order_items.variant_id, qty: order_items.qty })
      .from(order_items)
      .where(and(eq(order_items.order_id, orderId), isNotNull(order_items.variant_id))),
  ]);
  if (order.length === 0) throw new Error(`order ${orderId} not found`);

  const stillPending = sql`exists (select 1 from ${orders} where ${orders.id} = ${orderId} and ${orders.stock_decremented_at} is null)`;

  await runBatch(db, [
    ...items.map((item) =>
      db
        .update(product_variants)
        .set({ stock: sql`${product_variants.stock} - ${item.qty}` })
        .where(
          and(
            eq(product_variants.id, item.variant_id!),
            gte(product_variants.stock, item.qty),
            stillPending,
          ),
        ),
    ),
    db
      .update(orders)
      .set({ stock_decremented_at: new Date().toISOString() })
      .where(and(eq(orders.id, orderId), isNull(orders.stock_decremented_at))),
  ]);
}
