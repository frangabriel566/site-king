import { describe, expect, it } from "vitest";
import { checkCoupon, checkCouponOffer, couponOfferLabel } from "@/lib/coupons/rules";
import { couponSchema } from "@/lib/validations/coupon";

const brl = (value: string) => `R$ ${value}`;

const base = {
  code: "DEZ",
  type: "percent" as const,
  value: 10,
  min_total: 0,
  active: true,
  starts_at: null,
  expires_at: null,
  max_uses: null,
  used_count: 0,
  free_shipping: false,
};

describe("couponOfferLabel", () => {
  it("says what the coupon gives", () => {
    expect(couponOfferLabel({ type: "percent", value: 10, freeShipping: false })).toBe("-10%");
    expect(couponOfferLabel({ type: "percent", value: 7.5, freeShipping: false })).toBe("-7,5%");
    expect(couponOfferLabel({ type: "fixed", value: 20, freeShipping: false })).toBe(`-${brl("20,00")}`);
    expect(couponOfferLabel({ type: "fixed", value: 0, freeShipping: true })).toBe("frete grátis");
    expect(couponOfferLabel({ type: "percent", value: 10, freeShipping: true })).toBe("-10% e frete grátis");
  });
});

describe("checkCouponOffer (no bag yet)", () => {
  it("accepts a good coupon whatever its minimum, with no amount", () => {
    const check = checkCouponOffer({ ...base, min_total: 500 });
    expect(check).toMatchObject({ ok: true, offer: { code: "DEZ", minTotal: 500 } });
  });

  it("still refuses an expired or exhausted coupon", () => {
    expect(checkCouponOffer({ ...base, expires_at: "2020-01-01" })).toMatchObject({ ok: false, reason: "EXPIRED" });
    expect(checkCouponOffer({ ...base, max_uses: 2, used_count: 2 })).toMatchObject({ ok: false, reason: "EXHAUSTED" });
  });
});

describe("checkCoupon below the minimum", () => {
  it("says how much is missing and keeps the offer", () => {
    expect(checkCoupon({ ...base, min_total: 200 }, 129.9)).toMatchObject({
      ok: false,
      reason: "BELOW_MINIMUM",
      missing: 70.1,
      offer: { code: "DEZ" },
    });
  });
});

describe("couponSchema", () => {
  const form = { code: "frete", min_total: "", max_uses: "", starts_at: "", expires_at: "", active: true };

  it('stores "Frete grátis" as a fixed R$ 0 coupon that zeroes the freight', () => {
    const parsed = couponSchema.parse({ ...form, type: "free_shipping" });
    expect(parsed).toMatchObject({ code: "FRETE", type: "fixed", value: 0, free_shipping: true });
  });

  it("asks for a value on percent and fixed coupons", () => {
    const parsed = couponSchema.safeParse({ ...form, type: "percent" });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("Informe o valor do desconto");
  });

  it("keeps one-use-per-phone", () => {
    const parsed = couponSchema.parse({ ...form, type: "percent", value: "10", one_per_phone: true });
    expect(parsed).toMatchObject({ type: "percent", value: 10, one_per_phone: true });
  });
});
