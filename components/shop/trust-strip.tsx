"use client";

import { CreditCard, RotateCcw, ShieldCheck, Truck, type LucideIcon } from "lucide-react";
import { trustItems, type TrustItemKind } from "@/lib/shop-config";
import { useShopConfig } from "@/components/shop/shop-config-provider";

export const TRUST_ICONS: Record<TrustItemKind, LucideIcon> = {
  shipping: Truck,
  installments: CreditCard,
  exchange: RotateCcw,
  secure: ShieldCheck,
};

/**
 * Frete, trocas e compra segura, right under the buy button — the moment
 * the shopper hesitates. Texts come from Configurações → Vitrine; a line
 * the store hasn't filled in is left out, and with none filled in the
 * strip doesn't render at all.
 */
export function TrustStrip({ className = "" }: { className?: string }) {
  const items = trustItems(useShopConfig(), ["shipping", "exchange", "secure"]);
  if (items.length === 0) return null;

  return (
    <ul className={`flex flex-col gap-2.5 rounded-lg bg-surface px-4 py-3 ${className}`}>
      {items.map(({ kind, label }) => {
        const Icon = TRUST_ICONS[kind];
        return (
          <li key={kind} className="flex items-center gap-2.5 text-[13px] leading-snug text-fg">
            <Icon className="size-4 shrink-0 text-buy" aria-hidden="true" />
            {label}
          </li>
        );
      })}
    </ul>
  );
}
