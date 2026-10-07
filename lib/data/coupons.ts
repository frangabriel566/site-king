import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Tables } from "@/lib/database.types";
import { requireAdminPage } from "@/lib/auth/guards";
import { roundMoney } from "@/lib/money";

export type Coupon = Tables<"coupons">;

const { coupons } = schema;

export async function getAllCouponsAdmin(): Promise<Coupon[]> {
  await requireAdminPage();
  return getDb().query.coupons.findMany({ orderBy: asc(coupons.code) });
}

export async function getCouponByIdAdmin(id: string): Promise<Coupon | null> {
  await requireAdminPage();
  const row = await getDb().query.coupons.findFirst({ where: eq(coupons.id, id) });
  return row ?? null;
}

export type ValidCoupon = { id: string; code: string; discount: number };

/**
 * Server-side coupon check (was the `validate_coupon` Postgres function).
 * Coupons are never listed to shoppers; this only answers "does this code
 * apply to this subtotal, and for how much". `null` when the code does
 * not exist, is inactive, has expired (`expires_at` is a date — the
 * coupon stops working at 00:00 UTC that day, as before) or the subtotal
 * is under its minimum.
 */
export async function validateCoupon(code: string, subtotal: number): Promise<ValidCoupon | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const coupon = await getDb().query.coupons.findFirst({
    where: sql`lower(${coupons.code}) = lower(${trimmed}) and ${coupons.active} = 1`,
  });
  if (!coupon) return null;
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() <= Date.now()) return null;
  if (subtotal < (coupon.min_total ?? 0)) return null;

  const discount =
    coupon.type === "percent"
      ? roundMoney((subtotal * coupon.value) / 100)
      : Math.min(coupon.value, subtotal);

  return { id: coupon.id, code: coupon.code, discount: roundMoney(discount) };
}
