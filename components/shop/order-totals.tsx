import type { AppliedCoupon } from "@/lib/hooks/use-bag-coupon";
import { orderSummaryLines, type OrderSummaryLine } from "@/lib/orders/summary";
import type { ShippingMode } from "@/lib/shipping-mode";

const VALUE_CLASS: Record<OrderSummaryLine["kind"], string> = {
  subtotal: "text-fg",
  discount: "font-semibold whitespace-nowrap text-buy",
  shipping: "text-fg",
  total: "text-xl font-bold text-price",
};

/**
 * Subtotal, coupon, freight and total — the lines of lib/orders/summary.ts,
 * the same ones the WhatsApp message and the order page print, so the
 * shopper never sees two ways of adding up the same order.
 *
 * With the freight agreed on WhatsApp the line says "a combinar" and the
 * total is "Total dos produtos"; free shipping (the store's rule or the
 * coupon's) says "grátis". The total never goes below zero.
 */
export function OrderTotals({
  subtotal,
  itemCount,
  coupon,
  shippingMode,
  className = "",
}: {
  subtotal: number;
  /** Pieces, not lines. */
  itemCount: number;
  coupon: AppliedCoupon | null;
  shippingMode: ShippingMode;
  className?: string;
}) {
  const lines = orderSummaryLines({
    subtotal,
    itemCount,
    discount: coupon?.discount ?? 0,
    couponCode: coupon?.code ?? null,
    shippingMode,
  });

  return (
    <dl className={`flex flex-col gap-2 text-sm ${className}`} aria-live="polite">
      {lines.map((line) =>
        line.kind === "total" ? (
          <div
            key={line.kind}
            className="mt-1 flex items-baseline justify-between gap-3 border-t border-line pt-3"
          >
            <dt className="text-base font-semibold text-fg">{line.label}</dt>
            <dd className={VALUE_CLASS.total}>{line.value}</dd>
          </div>
        ) : (
          <div key={line.kind} className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{line.label}</dt>
            <dd
              className={
                line.kind === "shipping" && shippingMode === "free"
                  ? "font-semibold text-buy"
                  : VALUE_CLASS[line.kind]
              }
            >
              {line.value}
            </dd>
          </div>
        ),
      )}
    </dl>
  );
}
