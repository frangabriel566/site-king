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

/** What a coupon gives, whatever the bag: what the product page shows, and
 * the "Cupom X aplicado: -10%" line everywhere. */
export type CouponOffer = {
  code: string;
  type: Tables<"coupons">["type"];
  value: number;
  freeShipping: boolean;
  minTotal: number;
};

export type CouponCheck =
  | {
      ok: true;
      code: string;
      /** Off the subtotal, never more than it. */
      discount: number;
      freeShipping: boolean;
      offer: CouponOffer;
    }
  | {
      ok: false;
      reason: CouponRejection;
      message: string;
      /** BELOW_MINIMUM only: the coupon is good, the bag is short by
       * `missing` — the storefront keeps it waiting instead of dropping it. */
      offer?: CouponOffer;
      missing?: number;
    };

/** What POST /api/coupons/validate answers. With an empty bag it checks
 * the coupon alone (`discount` 0) — the product page and the ?cupom= link. */
export type CouponValidationResponse =
  | {
      ok: true;
      code: string;
      discount: number;
      freeShipping: boolean;
      subtotal: number;
      offer: CouponOffer;
    }
  | {
      ok: false;
      reason: string;
      message: string;
      offer?: CouponOffer;
      missing?: number;
    };

export function couponOffer(
  coupon: Pick<CouponRow, "code" | "type" | "value" | "free_shipping" | "min_total">,
): CouponOffer {
  return {
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    freeShipping: coupon.free_shipping,
    minTotal: coupon.min_total,
  };
}

/** "-10%", "-R$ 20,00", "frete grátis" or "-10% e frete grátis". */
export function couponOfferLabel(offer: Pick<CouponOffer, "type" | "value" | "freeShipping">): string {
  const amount =
    offer.value > 0
      ? offer.type === "percent"
        ? `-${String(offer.value).replace(".", ",")}%`
        : `-${formatCurrency(offer.value)}`
      : null;
  if (amount && offer.freeShipping) return `${amount} e frete grátis`;
  return amount ?? "frete grátis";
}

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
 * The coupon alone, with no bag yet (the product page, the ?cupom= link):
 * whether it exists and can be used today. The minimum is left for the
 * bag — it is shown, not checked.
 */
export function checkCouponOffer(
  coupon: CouponRow | null | undefined,
  now = Date.now(),
): { ok: true; offer: CouponOffer } | { ok: false; reason: CouponRejection; message: string } {
  const check = checkCoupon(coupon, Number.POSITIVE_INFINITY, now);
  return check.ok ? { ok: true, offer: check.offer } : check;
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
    const missing = roundMoney(coupon.min_total - subtotal);
    return {
      ok: false,
      reason: "BELOW_MINIMUM",
      message: `Este cupom vale para compras a partir de ${formatCurrency(
        coupon.min_total,
      )}. Faltam ${formatCurrency(missing)}.`,
      offer: couponOffer(coupon),
      missing,
    };
  }
  return {
    ok: true,
    code: coupon.code,
    // An offer check (subtotal = ∞) has no amount to take off.
    discount: Number.isFinite(subtotal) ? couponDiscount(coupon, subtotal) : 0,
    freeShipping: coupon.free_shipping,
    offer: couponOffer(coupon),
  };
}
