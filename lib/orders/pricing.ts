import "server-only";
import { evaluateCoupon } from "@/lib/data/coupons";
import { getSiteSettings } from "@/lib/data/settings";
import { orderTotal, shippingModeFor } from "@/lib/orders/summary";
import type { ShippingMode } from "@/lib/shipping-mode";

export type OrderPricing = {
  subtotal: number;
  discount: number;
  /** As the store wrote it, or null without a coupon. */
  couponCode: string | null;
  shippingMode: ShippingMode;
  shipping: number;
  total: number;
};

export type OrderPricingResult =
  | { ok: true; pricing: OrderPricing }
  /** The coupon doesn't apply; `message` says why, for the shopper. */
  | { ok: false; message: string };

/**
 * What an order costs — one function for every door an order comes in
 * through (the WhatsApp order and the checkout), so the same bag can't be
 * priced two ways.
 *
 * `subtotal` must come from the database (the order's own lines), never
 * from the client. The coupon is checked again here: what the bag showed
 * was a preview. Freight is never charged yet — it is free (the store's
 * rule or the coupon) or agreed on WhatsApp; the Melhor Envio quote will
 * plug in here when the checkout uses it.
 */
export async function priceOrder(
  subtotal: number,
  couponCode: string | null | undefined,
): Promise<OrderPricingResult> {
  let discount = 0;
  let appliedCode: string | null = null;
  let couponFreeShipping = false;
  if (couponCode?.trim()) {
    const check = await evaluateCoupon(couponCode, subtotal);
    if (!check.ok) return { ok: false, message: check.message };
    discount = check.discount;
    appliedCode = check.code;
    couponFreeShipping = check.freeShipping;
  }

  const { free_shipping_threshold } = await getSiteSettings();
  const shippingMode = shippingModeFor(subtotal, free_shipping_threshold, couponFreeShipping);

  return {
    ok: true,
    pricing: {
      subtotal,
      discount,
      couponCode: appliedCode,
      shippingMode,
      shipping: 0,
      total: orderTotal({ subtotal, discount, shippingMode }),
    },
  };
}
