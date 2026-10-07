"use client";

import { ChevronDown } from "lucide-react";
import { useCart } from "@/lib/cart/context";
import type { CartItem } from "@/lib/cart/types";
import type { CartVariantOption } from "@/lib/hooks/use-cart-stock";
import { isColorlessVariant } from "@/lib/constants";
import { formatVariantLabel } from "@/lib/format";

/**
 * The "Cor · Tamanho" line of a bag item — with the size as a picker when
 * the piece comes in other sizes of the same color, so a wrong size is
 * fixed right there instead of removing the line and going back to the
 * product.
 *
 * A native <select>: on a phone it opens the system's own wheel/list,
 * which is bigger, more familiar and more accessible than anything drawn
 * here, and it costs no JavaScript. Sold-out sizes are listed (so the
 * shopper sees they exist) but can't be picked.
 */
export function BagVariantLine({
  item,
  sizes,
}: {
  item: CartItem;
  /** From useCartStock().sizesFor — empty means nothing to switch. */
  sizes: CartVariantOption[];
}) {
  const { items, changeVariant, setQty } = useCart();
  const label = formatVariantLabel(item.color, item.size);

  if (sizes.length === 0) {
    return label ? <p className="text-xs text-muted-foreground">{label}</p> : null;
  }

  function switchTo(variantId: string) {
    const option = sizes.find((size) => size.id === variantId);
    if (!option || option.id === item.variantId) return;
    // Merging into a line already holding that size adds the two up;
    // either way the total can't pass what exists of the new size.
    const already = items.find((line) => line.variantId === option.id)?.qty ?? 0;
    changeVariant(item.variantId, { variantId: option.id, color: option.color, size: option.size });
    if (item.qty + already > option.stock) setQty(option.id, option.stock);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {!isColorlessVariant(item.color) && (
        <span className="text-xs text-muted-foreground">{item.color}</span>
      )}
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Tamanho
        <span className="relative">
          <select
            value={item.variantId}
            onChange={(event) => switchTo(event.target.value)}
            aria-label={`Tamanho de ${item.name}`}
            className="h-9 min-w-16 appearance-none rounded-md border border-line bg-white py-0 pr-8 pl-3 text-sm font-semibold text-fg transition-colors hover:border-ink-muted focus-visible:border-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/20"
          >
            {sizes.map((size) => (
              <option
                key={size.id}
                value={size.id}
                disabled={size.stock <= 0 && size.id !== item.variantId}
              >
                {size.size}
                {size.stock <= 0 ? " (esgotado)" : ""}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-fg"
            aria-hidden="true"
          />
        </span>
      </label>
    </div>
  );
}
