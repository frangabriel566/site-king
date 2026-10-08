import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Tables } from "@/lib/database.types";
import { requireAdminPage } from "@/lib/auth/guards";
import {
  checkCoupon,
  checkCouponOffer,
  normalizeCouponCode,
  type CouponCheck,
} from "@/lib/coupons/rules";

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

/** The coupon alone, before there is a bag to price (checkCouponOffer). */
export async function evaluateCouponOffer(code: string): Promise<ReturnType<typeof checkCouponOffer>> {
  const normalized = normalizeCouponCode(code);
  if (!normalized) {
    return { ok: false, reason: "EMPTY_CODE", message: "Digite o código do cupom." };
  }
  const coupon = await getDb().query.coupons.findFirst({
    where: eq(coupons.code, normalized),
  });
  return checkCouponOffer(coupon);
}

/** Which of these codes are "um uso por telefone" — for the WhatsApp tab. */
export async function getOnePerPhoneCodes(codes: string[]): Promise<Set<string>> {
  await requireAdminPage();
  if (codes.length === 0) return new Set();
  const rows = await getDb()
    .select({ code: coupons.code })
    .from(coupons)
    .where(and(inArray(coupons.code, [...new Set(codes)].slice(0, 90)), eq(coupons.one_per_phone, true)));
  return new Set(rows.map((row) => row.code));
}

export type CouponOrder = Pick<
  Tables<"orders">,
  "id" | "code" | "order_number" | "status" | "total" | "discount" | "created_at" | "coupon_used_at"
>;

/** For the coupon's page in the panel: every order that carries it, newest
 * first, and whether its use was counted. */
export async function getCouponOrdersAdmin(code: string): Promise<CouponOrder[]> {
  await requireAdminPage();
  const { orders } = schema;
  return getDb()
    .select({
      id: orders.id,
      code: orders.code,
      order_number: orders.order_number,
      status: orders.status,
      total: orders.total,
      discount: orders.discount,
      created_at: orders.created_at,
      coupon_used_at: orders.coupon_used_at,
    })
    .from(orders)
    .where(eq(orders.coupon_code, code))
    .orderBy(desc(orders.created_at))
    .limit(500);
}
