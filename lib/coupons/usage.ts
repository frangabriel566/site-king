import "server-only";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { schema, type getDb } from "@/lib/db";
import { isCheckViolation } from "@/lib/db/errors";

type Db = ReturnType<typeof getDb>;

const { coupons } = schema;

/**
 * Coupon uses follow the order that took them: counted when the order is
 * created (in the same D1 batch, so an order and its use land together or
 * not at all), given back when it is canceled or expires.
 *
 * The limit itself is the `coupons_usage_check` constraint: taking a use
 * past `max_uses` fails the statement, which rolls the whole batch back —
 * two shoppers racing for the last use can't both get it.
 */

/** Order statuses that no longer hold their coupon's use. */
export const RELEASED_STATUSES: ReadonlySet<string> = new Set(["canceled", "expirado"]);

/** For an order batch. Fails the batch when the coupon is out of uses. */
export function takeCouponUse(db: Db, code: string) {
  return db
    .update(coupons)
    .set({ used_count: sql`${coupons.used_count} + 1` })
    .where(eq(coupons.code, code));
}

/** An order coming back from canceled: counts again only if there is a
 * use left — the store reopening an order must never fail over this. */
export function retakeCouponUse(db: Db, code: string) {
  return db
    .update(coupons)
    .set({ used_count: sql`${coupons.used_count} + 1` })
    .where(
      and(
        eq(coupons.code, code),
        or(isNull(coupons.max_uses), lt(coupons.used_count, coupons.max_uses)),
      ),
    );
}

export function releaseCouponUse(db: Db, code: string) {
  return db
    .update(coupons)
    .set({ used_count: sql`max(${coupons.used_count} - 1, 0)` })
    .where(eq(coupons.code, code));
}

export function isCouponLimitError(error: unknown): boolean {
  return isCheckViolation(error, "coupons_usage_check");
}
