import { formatCurrency, formatDate } from "@/lib/format";
import { roundMoney } from "@/lib/money";
import type { Tables } from "@/lib/database.types";

/**
 * The coupon rules, in one place: the validation route, the checkout and
 * the WhatsApp order all ask these, so the discount the shopper sees and
 * the one the order records are the same computation. Plain functions —
 * the database read lives in lib/data/coupons.ts.
 */

type CouponRow = Pick<
  Tables<"coupons">,
  | "code"
  | "type"
  | "value"
  | "min_total"
  | "active"
  | "starts_at"
  | "expires_at"
  | "max_uses"
  | "used_count"
  | "free_shipping"
>;

export type CouponRejection =
  | "EMPTY_CODE"
  | "NOT_FOUND"
  | "INACTIVE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "EXHAUSTED"
  | "BELOW_MINIMUM"
  | "EMPTY_CART";

export type CouponCheck =
  | {
      ok: true;
      code: string;
      /** Off the subtotal, never more than it. */
      discount: number;
      freeShipping: boolean;
    }
  | { ok: false; reason: CouponRejection; message: string };

/** What POST /api/coupons/validate answers. */
export type CouponValidationResponse =
  | { ok: true; code: string; discount: number; freeShipping: boolean; subtotal: number }
  | { ok: false; reason: string; message: string };

/** "teste 10", " Teste10 " and "TESTE10" are the same coupon. */
export function normalizeCouponCode(code: string): string {
  return code.replace(/\s+/g, "").toUpperCase();
}

/**
 * Validity is in whole days, Brasília time (UTC−3; no daylight saving
 * since 2019): a coupon valid "until 10/11" works through 23:59 that day.
 * Before, the end date was midnight UTC, which in Brazil cut the coupon
 * off at 21:00 the day before.
 */
const BRASILIA = "-03:00";

export function couponStartMs(startsAt: string): number {
  return Date.parse(`${startsAt.slice(0, 10)}T00:00:00.000${BRASILIA}`);
}

export function couponEndMs(expiresAt: string): number {
  return Date.parse(`${expiresAt.slice(0, 10)}T23:59:59.999${BRASILIA}`);
}

export function couponDiscount(
  coupon: Pick<CouponRow, "type" | "value">,
  subtotal: number,
): number {
  const raw = coupon.type === "percent" ? (subtotal * coupon.value) / 100 : coupon.value;
  return roundMoney(Math.max(0, Math.min(raw, subtotal)));
}

/**
 * Whether `coupon` applies to an order of `subtotal` right now, and for
 * how much — or why not, in words the shopper can act on.
 */
export function checkCoupon(
  coupon: CouponRow | null | undefined,
  subtotal: number,
  now = Date.now(),
): CouponCheck {
  if (!coupon) {
    return { ok: false, reason: "NOT_FOUND", message: "Cupom não encontrado. Confira o código." };
  }
  if (!coupon.active) {
    return { ok: false, reason: "INACTIVE", message: "Este cupom não está mais ativo." };
  }
  if (coupon.starts_at && now < couponStartMs(coupon.starts_at)) {
    return {
      ok: false,
      reason: "NOT_STARTED",
      message: `Este cupom vale a partir de ${formatDate(`${coupon.starts_at.slice(0, 10)}T12:00:00Z`)}.`,
    };
  }
  if (coupon.expires_at && now > couponEndMs(coupon.expires_at)) {
    return { ok: false, reason: "EXPIRED", message: "Este cupom expirou." };
  }
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
    return { ok: false, reason: "EXHAUSTED", message: "Este cupom atingiu o limite de usos." };
  }
  if (subtotal <= 0) {
    return {
      ok: false,
      reason: "EMPTY_CART",
      message: "Adicione produtos à sacola para usar um cupom.",
    };
  }
  if (subtotal < coupon.min_total) {
    return {
      ok: false,
      reason: "BELOW_MINIMUM",
      message: `Este cupom vale para compras a partir de ${formatCurrency(
        coupon.min_total,
      )}. Faltam ${formatCurrency(roundMoney(coupon.min_total - subtotal))}.`,
    };
  }
  return {
    ok: true,
    code: coupon.code,
    discount: couponDiscount(coupon, subtotal),
    freeShipping: coupon.free_shipping,
  };
}
