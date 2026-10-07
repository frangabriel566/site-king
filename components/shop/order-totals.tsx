import { formatCurrency } from "@/lib/format";
import { roundMoney } from "@/lib/money";
import type { AppliedCoupon } from "@/lib/hooks/use-bag-coupon";

/**
 * Subtotal, coupon, shipping and total — the same four lines in the bag,
 * the drawer and the checkout, so the shopper never sees two ways of
 * adding up the same order.
 *
 * `shipping` null means "not known here" (the bag, before the checkout
 * picks a method): the line says so and the total is labelled as without
 * shipping, rather than quietly leaving it out. Free shipping — the
 * store's rule or the coupon's — always shows as "Grátis". The total never
 * goes below zero.
 */
export function OrderTotals({
  subtotal,
  itemCount,
  coupon,
  shipping,
  freeShipping,
  shippingPending = "Calculado no checkout",
  className = "",
}: {
  subtotal: number;
  itemCount?: number;
  coupon: AppliedCoupon | null;
  shipping: number | null;
  freeShipping: boolean;
  /** What the shipping line says while it isn't known. */
  shippingPending?: string;
  className?: string;
}) {
  const discount = coupon?.discount ?? 0;
  const shippingKnown = freeShipping || shipping !== null;
  const total = roundMoney(
    Math.max(subtotal - discount + (freeShipping ? 0 : (shipping ?? 0)), 0),
  );

  return (
    <dl className={`flex flex-col gap-2 text-sm ${className}`} aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <dt className="text-muted-foreground">
          Subtotal
          {itemCount !== undefined && ` (${itemCount} ${itemCount === 1 ? "item" : "itens"})`}
        </dt>
        <dd className="text-fg">{formatCurrency(subtotal)}</dd>
      </div>
      {coupon && discount > 0 && (
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">
            Desconto <span className="whitespace-nowrap">(cupom {coupon.code})</span>
          </dt>
          <dd className="font-semibold whitespace-nowrap text-buy">-{formatCurrency(discount)}</dd>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <dt className="text-muted-foreground">Frete</dt>
        <dd className={freeShipping ? "font-semibold text-buy" : "text-fg"}>
          {freeShipping
            ? "Grátis"
            : shipping !== null
              ? formatCurrency(shipping)
              : <span className="text-xs text-muted-foreground">{shippingPending}</span>}
        </dd>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-line pt-3">
        <dt className="text-base font-semibold text-fg">
          Total
          {!shippingKnown && (
            <span className="block text-xs font-normal text-muted-foreground">sem o frete</span>
          )}
        </dt>
        <dd className="text-xl font-bold text-price">{formatCurrency(total)}</dd>
      </div>
    </dl>
  );
}
