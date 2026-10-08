import "server-only";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { schema, type getDb } from "@/lib/db";
import { isCheckViolation } from "@/lib/db/errors";

type Db = ReturnType<typeof getDb>;

const { coupons, orders } = schema;

/**
 * A coupon use belongs to a confirmed sale: counted when the order is
 * confirmed (WhatsApp) or paid (Mercado Pago, or the status in Pedidos),
 * given back when that order is canceled. An order still waiting, expired
 * or abandoned never spends one, so the limit only counts real sales.
 *
 * `orders.coupon_used_at` records that this order's use was counted. Both
 * helpers below test it, so counting twice or giving back twice — a double
 * click, paid → shipped, a webhook retry — changes nothing.
 *
 * The limit itself is the `coupons_usage_check` constraint: counting past
 * `max_uses` fails the statement, which rolls its whole batch back — two
 * confirmations racing for the last use can't both get it.
 */

/** Statuses of a sale that happened: its coupon use is counted. */
export const COUNTED_STATUSES: ReadonlySet<string> = new Set([
  "paid",
  "processing",
  "shipped",
  "delivered",
]);

/** Statuses that give a counted use back. */
export const RELEASED_STATUSES: ReadonlySet<string> = new Set(["canceled", "expirado"]);

/**
 * Counts `orderId`'s coupon use, for a batch: the coupon first, while the
 * order still reads as uncounted, then the mark. Nothing happens for an
 * order without a coupon or already counted. `status`: count only while
 * the order still has it (the confirmation, against a double click).
 */
export function countCouponUse(db: Db, orderId: string, status?: string) {
  const uncounted = and(
    eq(orders.id, orderId),
    isNotNull(orders.coupon_code),
    isNull(orders.coupon_used_at),
    status ? sql`${orders.status} = ${status}` : undefined,
  );
  return [
    db
      .update(coupons)
      .set({ used_count: sql`${coupons.used_count} + 1` })
      .where(sql`${coupons.code} = (select ${orders.coupon_code} from ${orders} where ${uncounted})`),
    db.update(orders).set({ coupon_used_at: new Date().toISOString() }).where(uncounted),
  ] as const;
}

/** Gives `orderId`'s counted use back, for a batch (the reverse of
 * countCouponUse). Nothing happens if it was never counted. */
export function releaseCouponUse(db: Db, orderId: string) {
  const counted = and(eq(orders.id, orderId), isNotNull(orders.coupon_used_at));
  return [
    db
      .update(coupons)
      .set({ used_count: sql`max(${coupons.used_count} - 1, 0)` })
      .where(sql`${coupons.code} = (select ${orders.coupon_code} from ${orders} where ${counted})`),
    db.update(orders).set({ coupon_used_at: null }).where(counted),
  ] as const;
}

export function isCouponLimitError(error: unknown): boolean {
  return isCheckViolation(error, "coupons_usage_check");
}
