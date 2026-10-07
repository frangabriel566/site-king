"use client";

import { trustItems } from "@/lib/shop-config";
import { useShopConfig } from "@/components/shop/shop-config-provider";
import { TRUST_ICONS } from "@/components/shop/trust-strip";

/** The home page's reassurance row. Only what the store configured in
 * Configurações → Vitrine — no promise is printed by default. */
export function TrustBadges() {
  const items = trustItems(useShopConfig(), ["shipping", "installments", "exchange", "secure"]);
  if (items.length === 0) return null;

  return (
    <div className="border-y border-line bg-surface">
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-4 px-4 py-5 md:grid-cols-4 md:px-8">
        {items.map(({ kind, label }) => {
          const Icon = TRUST_ICONS[kind];
          return (
            <div key={kind} className="flex items-center gap-3">
              <Icon className="size-5 shrink-0 text-gold-text" aria-hidden="true" />
              <span className="text-xs font-medium text-fg sm:text-sm">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
