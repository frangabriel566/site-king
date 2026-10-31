"use client";

import Image from "next/image";
import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { ProductSelect } from "@/components/admin/product-select";
import type { ProductOption } from "@/lib/data/products";

/**
 * Painel → Página inicial: pick a product, then one of its photos. Picking
 * a product takes its first photo at once; tapping another thumbnail
 * swaps it. The photo URL is the product's own file, shared, never copied.
 */
export function ProductPhotoPicker({
  id,
  label,
  noneLabel,
  productId,
  onProductChange,
  value,
  onChange,
  productOptions,
  photos,
}: {
  id: string;
  label: string;
  noneLabel: string;
  /** null: no product picked. */
  productId: string | null;
  onProductChange: (productId: string | null) => void;
  value: string | null;
  onChange: (url: string | null) => void;
  productOptions: ProductOption[];
  /** Every photo of each product, by product id. */
  photos: Record<string, string[]>;
}) {
  const productPhotos = productId ? (photos[productId] ?? []) : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>{label}</Label>
        <ProductSelect
          id={id}
          value={productId}
          noneLabel={noneLabel}
          productOptions={productOptions}
          onChange={(picked) => {
            onProductChange(picked);
            if (picked) onChange(photos[picked]?.[0] ?? null);
          }}
        />
      </div>

      {productId && productPhotos.length === 0 && (
        <p className="text-xs text-ink-muted">Esse produto não tem foto. Envie uma foto abaixo.</p>
      )}

      {productPhotos.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-ink-muted">Toque na foto que vai aparecer no site:</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {productPhotos.map((url) => {
              const selected = url === value;
              return (
                <button
                  key={url}
                  type="button"
                  onClick={() => onChange(url)}
                  aria-pressed={selected}
                  aria-label={selected ? "Foto escolhida" : "Escolher esta foto"}
                  className={`relative aspect-[4/5] overflow-hidden rounded-md border-2 bg-black transition-colors duration-150 ${
                    selected ? "border-gold" : "border-transparent hover:border-line-strong"
                  }`}
                >
                  <Image src={url} alt="" fill unoptimized sizes="96px" className="object-cover" />
                  {selected && (
                    <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-gold text-black">
                      <Check className="size-3.5" aria-hidden="true" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
