import "server-only";
import { evaluateCoupon } from "@/lib/data/coupons";
import { getSiteSettings } from "@/lib/data/settings";
import {
  freightCharge,
  orderTotal,
  shippingModeFor,
  type FreightOption,
} from "@/lib/orders/summary";
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
  | {
      ok: false;
      message: string;
      /** Which part failed: the coupon, or the freight option chosen (gone
       * or repriced since the shopper saw it). */
      reason: "coupon" | "freight";
    };

/** The checkout's freight: the quote the server just made for the order's
 * own lines and address, and the option the shopper picked. */
export type FreightChoice = {
  options: FreightOption[];
  serviceId: number;
  /** The price the shopper saw. A different price now is an error the
   * checkout shows, never a silent change to what they pay. */
  expectedPrice?: number;
};

/**
 * What an order costs — one function for every door an order comes in
 * through (the WhatsApp order and the checkout), so the same bag can't be
 * priced two ways.
 *
 * `subtotal` must come from the database (the order's own lines), never
 * from the client. The coupon is checked again here: what the bag showed
 * was a preview.
 *
 * Freight: without `freight` (the WhatsApp order) it is free (the store's
 * rule or the coupon) or agreed on WhatsApp. With it (the checkout) it is
 * the Melhor Envio option chosen, the free-shipping rule covering only the
 * cheapest one (freightCharge).
 */
export async function priceOrder(
  subtotal: number,
  couponCode: string | null | undefined,
  freight?: FreightChoice,
): Promise<OrderPricingResult> {
  let discount = 0;
  let appliedCode: string | null = null;
  let couponFreeShipping = false;
  if (couponCode?.trim()) {
    const check = await evaluateCoupon(couponCode, subtotal);
    if (!check.ok) return { ok: false, reason: "coupon", message: check.message };
    discount = check.discount;
    appliedCode = check.code;
    couponFreeShipping = check.freeShipping;
  }

  const { free_shipping_threshold } = await getSiteSettings();
  const ruleMode = shippingModeFor(subtotal, free_shipping_threshold, couponFreeShipping);

  let shippingMode: ShippingMode = ruleMode;
  let shipping = 0;
  if (freight) {
    const charge = freightCharge(freight.options, freight.serviceId, ruleMode === "free");
    if (!charge) {
      return {
        ok: false,
        reason: "freight",
        message: "A opção de frete escolhida não está mais disponível. Escolha outra.",
      };
    }
    if (freight.expectedPrice !== undefined && Math.abs(charge.shipping - freight.expectedPrice) > 0.009) {
      return {
        ok: false,
        reason: "freight",
        message: "O valor do frete mudou. Confira as opções atualizadas e escolha de novo.",
      };
    }
    shippingMode = charge.shippingMode;
    shipping = charge.shipping;
  }

  return {
    ok: true,
    pricing: {
      subtotal,
      discount,
      couponCode: appliedCode,
      shippingMode,
      shipping,
      total: orderTotal({ subtotal, discount, shippingMode, shipping }),
    },
  };
}
