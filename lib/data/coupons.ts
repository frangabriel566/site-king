import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Tables } from "@/lib/database.types";
import { requireAdminPage } from "@/lib/auth/guards";
import { checkCoupon, normalizeCouponCode, type CouponCheck } from "@/lib/coupons/rules";

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

/**
 * Server-side coupon check. Coupons are never listed to shoppers; this
 * only answers "does this code apply to this subtotal, and for how much"
 * (or why not). The subtotal must come from the database — callers pass
 * what reviseCartItems / the order lines computed, never a client number.
 */
export async function evaluateCoupon(code: string, subtotal: number): Promise<CouponCheck> {
  const normalized = normalizeCouponCode(code);
  if (!normalized) {
    return { ok: false, reason: "EMPTY_CODE", message: "Digite o código do cupom." };
  }
  const coupon = await getDb().query.coupons.findFirst({
    where: eq(coupons.code, normalized),
  });
  return checkCoupon(coupon, subtotal);
}
