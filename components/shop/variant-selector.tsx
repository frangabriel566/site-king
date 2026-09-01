"use client";

import { useMemo, useState } from "react";
import { useCart } from "@/lib/cart/context";
import { SIZE_ORDER } from "@/lib/constants";
import type { ProductVariant } from "@/lib/data/products";
import { Button } from "@/components/ui/button";

export function VariantSelector({
  productId,
  productSlug,
  productName,
  price,
  image,
  variants,
}: {
  productId: string;
  productSlug: string;
  productName: string;
  price: number;
  image: string | null;
  variants: ProductVariant[];
}) {
  const { addItem, open } = useCart();

  const colors = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const v of variants) if (!map.has(v.color)) map.set(v.color, v.color_hex);
    return Array.from(map, ([color, color_hex]) => ({ color, color_hex }));
  }, [variants]);

  const [selectedColor, setSelectedColor] = useState(colors[0]?.color ?? "");
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sizesForColor = useMemo(() => {
    const list = variants.filter((v) => v.color === selectedColor);
    return list.sort((a, b) => {
      const ai = SIZE_ORDER.indexOf(a.size as (typeof SIZE_ORDER)[number]);
      const bi = SIZE_ORDER.indexOf(b.size as (typeof SIZE_ORDER)[number]);
      if (ai === -1 && bi === -1) return a.size.localeCompare(b.size);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [variants, selectedColor]);

  const selectedVariant = sizesForColor.find((v) => v.size === selectedSize);

  function handleColorChange(color: string) {
    setSelectedColor(color);
    setSelectedSize(null);
    setError(null);
  }

  function handleAdd() {
    if (!selectedVariant || selectedVariant.stock <= 0) {
      setError("Selecione um tamanho disponível.");
      return;
    }
    addItem({
      variantId: selectedVariant.id,
      productId,
      slug: productSlug,
      name: productName,
      color: selectedColor,
      size: selectedVariant.size,
      price,
      image,
      qty: 1,
    });
    setError(null);
    open();
  }

  return (
    <div>
      {colors.length > 0 && (
        <div className="mb-6">
          <p className="text-label mb-3">Cor — {selectedColor}</p>
          <div className="flex flex-wrap gap-2">
            {colors.map(({ color, color_hex }) => (
              <button
                key={color}
                type="button"
                onClick={() => handleColorChange(color)}
                title={color}
                aria-pressed={selectedColor === color}
                className={`flex size-9 items-center justify-center border transition-colors duration-200 ease-out ${
                  selectedColor === color ? "border-fg" : "border-line hover:border-ink-muted"
                }`}
              >
                <span
                  className="size-5 rounded-full border border-line"
                  style={{ backgroundColor: color_hex ?? "#8A8A8A" }}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6">
        <p className="text-label mb-3">Tamanho</p>
        <div className="flex flex-wrap gap-2">
          {sizesForColor.map((variant) => {
            const outOfStock = variant.stock <= 0;
            return (
              <button
                key={variant.id}
                type="button"
                disabled={outOfStock}
                onClick={() => {
                  setSelectedSize(variant.size);
                  setError(null);
                }}
                aria-pressed={selectedSize === variant.size}
                className={`relative h-10 min-w-11 border px-3 text-xs uppercase transition-colors duration-200 ease-out ${
                  outOfStock
                    ? "cursor-not-allowed border-line text-ink-muted"
                    : selectedSize === variant.size
                      ? "border-fg bg-fg text-bg"
                      : "border-line text-fg hover:border-fg"
                }`}
              >
                <span className={outOfStock ? "line-through" : undefined}>
                  {variant.size}
                </span>
              </button>
            );
          })}
        </div>
        {error && <p className="mt-3 text-xs text-[var(--danger)]">{error}</p>}
      </div>

      <Button size="xl" className="w-full" onClick={handleAdd}>
        Adicionar à sacola
      </Button>
    </div>
  );
}
