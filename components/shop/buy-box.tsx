"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ShieldCheck, Lock, RotateCcw } from "lucide-react";
import { useCart } from "@/lib/cart/context";
import { SIZE_ORDER, isSimpleVariant } from "@/lib/constants";
import { formatCurrency, formatInstallments } from "@/lib/format";
import { SizeGuideModal } from "@/components/shop/size-guide-modal";
import { ShippingEstimate } from "@/components/shop/shipping-estimate";
import { Button } from "@/components/ui/button";
import type { ProductWithRelations } from "@/lib/data/products";

const BADGE_LABEL: Record<string, string> = {
  lancamento: "Lançamento",
  oferta: "Oferta",
};

export function BuyBox({
  product,
  mainImage,
  selectedColor,
  onColorChange,
}: {
  product: ProductWithRelations;
  mainImage: string | null;
  /** Lifted up to the parent (ProductMedia) so selecting a color can also
   * swap the gallery to that color's photo, when one was uploaded. */
  selectedColor: string;
  onColorChange: (color: string) => void;
}) {
  const { addItem, open } = useCart();
  const router = useRouter();
  const variants = product.product_variants;

  // A "produto sem variações" is stored as one variant with the sentinel
  // color/size — there's nothing for the shopper to pick, so the color
  // and size sections just don't apply.
  const isSimpleProduct =
    variants.length === 1 && isSimpleVariant(variants[0].color, variants[0].size);
  const simpleVariant = isSimpleProduct ? variants[0] : null;

  const colors = useMemo(() => {
    if (isSimpleProduct) return [];
    const map = new Map<string, { color_hex: string | null; image_url: string | null }>();
    for (const v of variants) {
      if (!map.has(v.color)) map.set(v.color, { color_hex: v.color_hex, image_url: v.image_url });
    }
    return Array.from(map, ([color, meta]) => ({ color, ...meta }));
  }, [variants, isSimpleProduct]);

  const allSizes = useMemo(() => {
    if (isSimpleProduct) return [];
    return Array.from(new Set(variants.map((v) => v.size)));
  }, [variants, isSimpleProduct]);

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sizesForColor = useMemo(() => {
    if (isSimpleProduct) return [];
    const list = variants.filter((v) => v.color === selectedColor);
    return list.sort((a, b) => {
      const ai = SIZE_ORDER.indexOf(a.size as (typeof SIZE_ORDER)[number]);
      const bi = SIZE_ORDER.indexOf(b.size as (typeof SIZE_ORDER)[number]);
      if (ai === -1 && bi === -1) return a.size.localeCompare(b.size);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [variants, selectedColor, isSimpleProduct]);

  const selectedVariant = isSimpleProduct
    ? simpleVariant
    : sizesForColor.find((v) => v.size === selectedSize);

  function handleColorChange(color: string) {
    onColorChange(color);
    setSelectedSize(null);
    setError(null);
  }

  function buildCartItem() {
    if (!selectedVariant || selectedVariant.stock <= 0) {
      setError(isSimpleProduct ? "Produto esgotado." : "Selecione um tamanho disponível.");
      return null;
    }
    setError(null);
    return {
      variantId: selectedVariant.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      color: isSimpleProduct ? "" : selectedColor,
      size: isSimpleProduct ? "" : selectedVariant.size,
      price: product.price,
      image: mainImage,
      qty: 1,
    };
  }

  function handleAddToBag() {
    const item = buildCartItem();
    if (!item) return;
    addItem(item);
    open();
  }

  function handleBuyNow() {
    const item = buildCartItem();
    if (!item) return;
    addItem(item);
    router.push("/checkout");
  }

  return (
    <div>
      {product.badge && (
        <span className="mb-3 inline-block rounded-full bg-gold px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-fg">
          {BADGE_LABEL[product.badge]}
        </span>
      )}

      <h1 className="text-2xl font-bold leading-tight text-fg">{product.name}</h1>
      <p className="mt-1 text-xs text-muted-foreground">Ref. {product.id.slice(0, 8).toUpperCase()}</p>
      {product.short_description && (
        <p className="mt-2 text-sm text-fg">{product.short_description}</p>
      )}

      <div className="mt-4">
        {product.compare_at_price && (
          <p className="text-sm text-muted-foreground line-through">
            {formatCurrency(product.compare_at_price)}
          </p>
        )}
        <p className="text-[26px] font-bold text-price">{formatCurrency(product.price)}</p>
        {product.compare_at_price && (
          <p className="text-sm font-medium text-discount">
            {formatCurrency(product.price)} no Pix
          </p>
        )}
        <p className="text-sm text-muted-foreground">{formatInstallments(product.price)}</p>
      </div>

      {colors.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-sm font-medium text-fg">Cor — {selectedColor}</p>
          <div className="flex flex-wrap gap-2">
            {colors.map(({ color, color_hex, image_url }) => (
              <button
                key={color}
                type="button"
                onClick={() => handleColorChange(color)}
                title={color}
                aria-pressed={selectedColor === color}
                className={`relative flex size-14 items-center justify-center overflow-hidden rounded-md border-2 transition-colors duration-150 ease-out ${
                  selectedColor === color ? "border-cta" : "border-line hover:border-muted"
                }`}
              >
                {image_url ? (
                  // The color's own photo — same picture the gallery
                  // switches to — doubles as its swatch, like a real photo
                  // thumbnail instead of an abstract color dot.
                  <Image src={image_url} alt={color} fill sizes="56px" className="object-cover" />
                ) : color_hex ? (
                  <span
                    className="size-6 rounded-full border border-line"
                    style={{ backgroundColor: color_hex }}
                    aria-hidden="true"
                  />
                ) : (
                  // No hex saved for this color — a blank gray dot would be
                  // indistinguishable from every other color-less swatch, so
                  // fall back to the color's initial letter instead of a
                  // circle that carries no information at all.
                  <span
                    className="flex size-6 items-center justify-center rounded-full border border-line bg-surface text-[10px] font-semibold text-fg"
                    aria-hidden="true"
                  >
                    {color.trim().charAt(0).toUpperCase()}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {!isSimpleProduct && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-fg">Tamanho</p>
            <SizeGuideModal sizes={allSizes} />
          </div>
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
                  className={`relative flex h-11 min-w-11 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors duration-150 ease-out ${
                    outOfStock
                      ? "cursor-not-allowed border-line text-muted-foreground"
                      : selectedSize === variant.size
                        ? "border-cta bg-cta text-white"
                        : "border-line text-fg hover:border-cta"
                  }`}
                >
                  <span className={outOfStock ? "line-through" : undefined}>{variant.size}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isSimpleProduct && simpleVariant && simpleVariant.stock <= 0 && (
        <p className="mt-6 text-sm font-medium text-alert">Produto esgotado.</p>
      )}
      {error && <p className="mt-3 text-xs text-alert">{error}</p>}

      <div className="mt-6 flex flex-col gap-3">
        <Button size="xl" className="w-full bg-cta text-white hover:bg-cta/90" onClick={handleBuyNow}>
          Comprar
        </Button>
        <Button size="xl" variant="outline" className="w-full" onClick={handleAddToBag}>
          Adicionar à sacola
        </Button>
      </div>

      <div className="mt-6 border-t border-line pt-6">
        <ShippingEstimate />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Lock className="size-4" aria-hidden="true" /> Compra segura
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-4" aria-hidden="true" /> Dados protegidos
        </span>
        <span className="flex items-center gap-1.5">
          <RotateCcw className="size-4" aria-hidden="true" /> Troca garantida
        </span>
      </div>
    </div>
  );
}
