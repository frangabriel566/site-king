import { formatCurrency } from "@/lib/format";
import { roundMoney } from "@/lib/money";
import { qualifiesForFreeShipping } from "@/lib/shop-config";
import type { ShippingMode } from "@/lib/shipping-mode";

/**
 * The order's totals, written once.
 *
 * The bag, the drawer, the checkout, the WhatsApp message and the order
 * pages all print these same lines with the same words, so the shopper
 * never meets two ways of adding up one order. Plain functions on purpose:
 * the bag is a Client Component and the order is priced on the server,
 * and both must say the same thing to the cent.
 */

/**
 * Freight while nothing quotes it: free by the store's rule (on the
 * products' subtotal, before the coupon) or by a coupon that covers it,
 * otherwise agreed in the WhatsApp conversation. The server prices the
 * order with this too (lib/orders/pricing.ts).
 */
export function shippingModeFor(
  subtotal: number,
  freeShippingThreshold: number | null,
  couponFreeShipping: boolean,
): Extract<ShippingMode, "free" | "to_agree"> {
  return couponFreeShipping || qualifiesForFreeShipping(subtotal, freeShippingThreshold)
    ? "free"
    : "to_agree";
}

export type OrderSummaryInput = {
  /** The products, before the coupon. */
  subtotal: number;
  /** Pieces, not lines. */
  itemCount: number;
  discount: number;
  couponCode: string | null;
  shippingMode: ShippingMode;
  /** What was charged for freight; only read when `charged`. */
  shipping?: number;
  /** A recorded order's own total. Left out, it is worked out here. */
  total?: number;
};

export type OrderSummaryLine = {
  kind: "subtotal" | "discount" | "shipping" | "total";
  label: string;
  value: string;
};

/** Subtotal − discount (+ freight, when charged), never below zero. */
export function orderTotal({
  subtotal,
  discount,
  shippingMode,
  shipping = 0,
}: Pick<OrderSummaryInput, "subtotal" | "discount" | "shippingMode" | "shipping">): number {
  const freight = shippingMode === "charged" ? shipping : 0;
  return roundMoney(Math.max(subtotal - discount + freight, 0));
}

export function shippingText(mode: ShippingMode, shipping = 0): string {
  if (mode === "to_agree") return "a combinar";
  if (mode === "free" || shipping <= 0) return "grátis";
  return formatCurrency(shipping);
}

export function orderSummaryLines(input: OrderSummaryInput): OrderSummaryLine[] {
  const { subtotal, itemCount, discount, couponCode, shippingMode, shipping = 0 } = input;
  const lines: OrderSummaryLine[] = [
    {
      kind: "subtotal",
      label: `Subtotal (${itemCount} ${itemCount === 1 ? "item" : "itens"})`,
      value: formatCurrency(subtotal),
    },
  ];
  if (discount > 0) {
    lines.push({
      kind: "discount",
      label: couponCode ? `Desconto (cupom ${couponCode})` : "Desconto",
      value: `-${formatCurrency(discount)}`,
    });
  }
  lines.push({ kind: "shipping", label: "Frete", value: shippingText(shippingMode, shipping) });
  lines.push({
    // "dos produtos" whenever no freight was added — a combinar or free
    // alike, so the words never change with the coupon. Only a charged
    // freight makes it the whole bill.
    kind: "total",
    label: shippingMode === "charged" ? "Total" : "Total dos produtos",
    value: formatCurrency(input.total ?? orderTotal(input)),
  });
  return lines;
}

/** A recorded order, as the order pages print it. */
export function summaryFromOrder(order: {
  subtotal: number;
  discount: number;
  coupon_code: string | null;
  shipping_mode: ShippingMode;
  shipping: number;
  total: number;
  order_items: { qty: number }[];
}): OrderSummaryInput {
  return {
    subtotal: order.subtotal,
    itemCount: order.order_items.reduce((sum, item) => sum + item.qty, 0),
    discount: order.discount,
    couponCode: order.coupon_code,
    shippingMode: order.shipping_mode,
    shipping: order.shipping,
    total: order.total,
  };
}

/** The same lines for the WhatsApp message, the total in bold (`*`). */
export function orderSummaryText(input: OrderSummaryInput): string[] {
  return orderSummaryLines(input).map((line) =>
    line.kind === "total" ? `*${line.label}: ${line.value}*` : `${line.label}: ${line.value}`,
  );
}
