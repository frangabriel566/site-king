"use client";

import { Truck } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { qualifiesForFreeShipping } from "@/lib/shop-config";
import { useShopConfig } from "@/components/shop/shop-config-provider";

/**
 * "Faltam R$ X para frete grátis" with a bar filling up to the store's
 * free-shipping value (Configurações → Vitrine) — the same rule the
 * checkout applies, so the promise here is the one that's kept. Renders
 * nothing when the store has no free shipping.
 */
export function FreeShippingProgress({
  subtotal,
  className = "",
}: {
  subtotal: number;
  className?: string;
}) {
  const { freeShippingThreshold: threshold } = useShopConfig();
  if (!threshold || threshold <= 0) return null;

  const reached = qualifiesForFreeShipping(subtotal, threshold);
  const remaining = Math.max(threshold - subtotal, 0);
  const percent = Math.min(100, Math.round((subtotal / threshold) * 100));

  return (
    <div className={className}>
      <p className="flex items-center gap-2 text-sm text-fg" aria-live="polite">
        <Truck className="size-4 shrink-0 text-buy" aria-hidden="true" />
        {reached ? (
          <span className="font-semibold text-buy">Você ganhou frete grátis!</span>
        ) : (
          <span>
            Faltam <strong className="font-bold text-buy">{formatCurrency(remaining)}</strong> para
            frete grátis
          </span>
        )}
      </p>
      <div
        role="progressbar"
        aria-label="Progresso para frete grátis"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full bg-buy transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
