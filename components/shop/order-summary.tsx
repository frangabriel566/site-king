"use client";

import { SafeImage } from "@/components/shop/safe-image";
import { formatCurrency, formatVariantLabel } from "@/lib/format";
import { CouponField } from "@/components/shop/coupon-field";
import { OrderTotals } from "@/components/shop/order-totals";
import type { BagCoupon } from "@/lib/hooks/use-bag-coupon";
import type { RevisedItem } from "@/lib/data/checkout";

/**
 * The checkout's summary: what is being bought, the coupon field (the one
 * applied in the bag comes along already applied), and the same totals
 * block as the bag. The coupon's amount is the server's answer
 * (useBagCoupon); createOrderAction checks it again before recording it.
 */
export function OrderSummary({
  items,
  subtotal,
  shipping,
  freeShipping,
  coupon,
}: {
  items: RevisedItem[];
  subtotal: number;
  /** Null until the shipping step. */
  shipping: number | null;
  /** The store's rule or the coupon's. */
  freeShipping: boolean;
  coupon: BagCoupon;
}) {
  return (
    <div className="h-fit rounded-lg border border-line p-6">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Resumo do pedido
      </p>

      <ul className="mb-6 flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.variantId} className="flex items-center gap-3 text-sm">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-surface">
              {item.image && (
                <SafeImage src={item.image} alt="" fill sizes="56px" className="object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate">{item.name}</p>
              <p className="text-xs text-ink-muted">
                {[formatVariantLabel(item.color, item.size), `Qtd. ${item.availableQty}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <span>{formatCurrency(item.price * item.availableQty)}</span>
          </li>
        ))}
      </ul>

      <CouponField coupon={coupon} className="mb-5 border-t border-line pt-5" />

      <OrderTotals
        subtotal={subtotal}
        coupon={coupon.applied}
        shipping={shipping}
        freeShipping={freeShipping}
        shippingPending="Na etapa Frete"
        className="border-t border-line pt-5"
      />
    </div>
  );
}
