"use client";

import { ChevronDown } from "lucide-react";
import type { ProductOption } from "@/lib/data/products";

/**
 * A native <select> of products. On a phone it opens the system's own
 * list, which scrolls smoothly — the drawn dropdown shook when dragged on
 * iOS with a long product list (store owner, out/2026).
 */
export function ProductSelect({
  id,
  value,
  onChange,
  noneLabel,
  productOptions,
}: {
  id: string;
  /** null: nothing picked ("automático"). */
  value: string | null;
  onChange: (productId: string | null) => void;
  noneLabel: string;
  productOptions: ProductOption[];
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        className="h-11 w-full appearance-none truncate rounded-md border border-line bg-field py-0 pr-10 pl-3 text-base text-fg transition-colors hover:border-ink-muted focus-visible:border-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/20"
      >
        <option value="">{noneLabel}</option>
        {productOptions.map((product) => (
          <option key={product.id} value={product.id}>
            {product.name}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-muted"
      />
    </div>
  );
}
