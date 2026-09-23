"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Lock, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart/context";
import { SIZE_ORDER, isSimpleVariant } from "@/lib/constants";
import { formatCurrency, formatInstallments } from "@/lib/format";
import { SizeGuideModal } from "@/components/shop/size-guide-modal";
import { FreightCalculator } from "@/components/shop/freight-calculator";
import { Button } from "@/components/ui/button";
import type { ProductWithRelations } from "@/lib/data/products";

const BADGE_LABEL: Record<string, string> = {
  lancamento: "Lançamento",
  oferta: "Oferta",
  mais_vendido: "Mais vendido",
};

export type ProductColor = {
  color: string;
  color_hex: string | null;
  image_url: string | null;
};

export function BuyBox({
  product,
  colors,
  mainImage,
  selectedColor,
  onColorChange,
}: {
  product: ProductWithRelations;
  /** Built by the parent (ProductMedia) so the gallery's thumbnail column
   * and these swatches always list exactly the same colors. */
  colors: ProductColor[];
  mainImage: string | null;
  /** Lifted up to the parent (ProductMedia) so selecting a color can also
   * swap the gallery to that color's photo, when one was uploaded. */
  selectedColor: string;
  onColorChange: (color: string) => void;
}) {
  const { addItem, open } = useCart();
  const router = useRouter();
  const discountPercent = product.compare_at_price
    ? Math.round((1 - product.price / product.compare_at_price) * 100)
    : 0;
  const [isPending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const variants = product.product_variants;

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 1500);
    return () => clearTimeout(timer);
  }, [added]);

  // A "produto sem variações" is stored as one variant with the sentinel
  // color/size — there's nothing for the shopper to pick, so the color
  // and size sections just don't apply.
  const isSimpleProduct =
    variants.length === 1 && isSimpleVariant(variants[0].color, variants[0].size);
  const simpleVariant = isSimpleProduct ? variants[0] : null;

  const allSizes = useMemo(() => {
    if (isSimpleProduct) return [];
    return Array.from(new Set(variants.map((v) => v.size)));
  }, [variants, isSimpleProduct]);

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sizeSectionRef = useRef<HTMLDivElement>(null);

  // Any color change clears the chosen size — including the ones the
  // gallery makes on its own while autoplaying, which never come through
  // the swatches below.
  useEffect(() => {
    setSelectedSize(null);
    setError(null);
  }, [selectedColor]);

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

  // Every size at zero is a sold-out product, not a product whose sizes all
  // happen to be disabled — say so once, plainly, instead of leaving the
  // shopper to work it out from a row of struck-through buttons.
  const allOutOfStock = variants.every((variant) => variant.stock <= 0);

  function buildCartItem() {
    if (!selectedVariant || selectedVariant.stock <= 0) {
      setError(
        allOutOfStock
          ? "Produto esgotado."
          : isSimpleProduct
            ? "Produto esgotado."
            : "Escolha um tamanho para continuar.",
      );
      // Send them to the control that's blocking the purchase rather than
      // leaving a line of red text below the fold.
      if (!isSimpleProduct && !allOutOfStock) {
        sizeSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return null;
    }
    setError(null);
    // The bag has to show the colourway that was actually picked. This was
    // storing `mainImage` — the product's *first* gallery photo — so every
    // line arrived wearing the first colour on the page no matter what was
    // chosen: pick the green shirt, get a black one in the bag, with the
    // label underneath still correctly reading "Verde".
    //
    // The chosen variant's own photo first; then any photo on that
    // colourway, because the operator may have attached it to a different
    // size row of the same colour; and only then the product shot.
    const variantImage =
      selectedVariant.image_url ??
      variants.find((v) => v.color === selectedVariant.color && v.image_url)
        ?.image_url ??
      mainImage;

    return {
      variantId: selectedVariant.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      color: isSimpleProduct ? "" : selectedColor,
      size: isSimpleProduct ? "" : selectedVariant.size,
      price: product.price,
      image: variantImage,
      qty: 1,
    };
  }

  function handleAddToBag() {
    const item = buildCartItem();
    if (!item) return;
    addItem(item);
    setAdded(true);
    // Deliberately does not open the bag. Throwing a full-screen drawer up
    // after every add ends the shopping trip at one item — the shopper has
    // to dismiss it to carry on looking. The toast confirms the add and
    // offers the bag to whoever actually wants it; everyone else stays on
    // the page they were browsing.
    toast.success("Adicionado à sacola", {
      description: [item.color, item.size].filter(Boolean).join(" · ") || undefined,
      action: { label: "Ver sacola", onClick: open },
    });
  }

  function handleBuyNow() {
    const item = buildCartItem();
    if (!item) return;
    addItem(item);
    startTransition(() => {
      router.push("/checkout");
    });
  }

  return (
    <div>
      {(product.badge || product.category) && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          {product.badge && (
            <span className="inline-block rounded-full bg-gold px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-fg">
              {BADGE_LABEL[product.badge]}
            </span>
          )}
          {product.category && (
            <Link
              href={`/colecao?categoria=${product.category.slug}`}
              className="text-sm font-medium text-gold-text underline-offset-4 hover:underline"
            >
              Em {product.category.name}
            </Link>
          )}
        </div>
      )}

      <h1 className="text-2xl font-bold leading-tight text-fg">{product.name}</h1>
      {/* The operator's own code when there is one — a sliced uuid is a
          database id, not a reference anybody can look up. */}
      <p className="mt-1 text-xs text-muted-foreground">
        Ref. {product.manufacturer_ref || product.id.slice(0, 8).toUpperCase()}
      </p>
      {product.short_description && (
        <p className="mt-2 text-sm text-fg">{product.short_description}</p>
      )}

      <div className="mt-3 rounded-lg border border-line p-4 sm:mt-4">
        {product.compare_at_price && (
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground line-through">
              {formatCurrency(product.compare_at_price)}
            </span>
            {discountPercent > 0 && (
              <span className="rounded-md bg-gold-soft px-1.5 py-0.5 text-xs font-bold text-fg">
                {discountPercent}% OFF
              </span>
            )}
          </p>
        )}
        <p className="mt-1 text-[26px] font-bold leading-none text-price">
          {formatCurrency(product.price)}
          <span className="ml-1.5 text-sm font-semibold text-discount">no Pix</span>
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {formatInstallments(product.price)}
        </p>
        {product.collection && (
          <span className="mt-3 inline-block rounded-md bg-surface px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {product.collection}
          </span>
        )}
      </div>

      {colors.length > 0 && (
        <div className="mt-5 sm:mt-6">
          <p className="mb-3 text-sm text-muted-foreground">
            <span className="font-semibold text-fg">Cor:</span> {selectedColor}
          </p>
          <div className="flex flex-wrap gap-2">
            {colors.map(({ color, color_hex, image_url }) => (
              <button
                key={color}
                type="button"
                onClick={() => onColorChange(color)}
                title={color}
                aria-label={color}
                aria-pressed={selectedColor === color}
                className={`relative flex size-14 items-center justify-center overflow-hidden rounded-md border-2 transition-colors duration-150 ease-out ${
                  selectedColor === color ? "border-gold" : "border-line hover:border-muted"
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
        <div
          ref={sizeSectionRef}
          className={`mt-5 scroll-mt-24 rounded-lg transition-shadow duration-200 ease-out sm:mt-6 ${
            error && !selectedSize ? "ring-2 ring-alert ring-offset-4 ring-offset-bg" : ""
          }`}
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-fg">Tamanho:</span>{" "}
              {selectedSize ?? "selecione"}
            </p>
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
                  // Unavailable reads as a filled, greyed-out key — the same
                  // way a marketplace listing shows a size it can't sell —
                  // and keeps the strike-through so the state doesn't rest
                  // on colour alone.
                  className={`relative flex h-11 min-w-11 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors duration-150 ease-out ${
                    outOfStock
                      ? "cursor-not-allowed border-line bg-surface text-muted-foreground/70"
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

      {allOutOfStock && (
        <p className="mt-6 text-sm font-medium text-alert">
          Produto esgotado{isSimpleProduct ? "" : " em todos os tamanhos"}.
        </p>
      )}
      {error && <p className="mt-3 text-xs text-alert">{error}</p>}

      <div className="mt-5 flex flex-col gap-3 sm:mt-6">
        <Button
          size="xl"
          className="w-full bg-cta text-white hover:bg-cta/90"
          onClick={handleBuyNow}
          disabled={isPending || allOutOfStock}
        >
          {isPending ? "Comprando…" : allOutOfStock ? "Esgotado" : "Comprar agora"}
        </Button>
        <Button
          size="xl"
          variant="outline"
          className="w-full"
          onClick={handleAddToBag}
          disabled={added || allOutOfStock}
        >
          {added ? "Adicionado ✓" : "Adicionar à sacola"}
        </Button>
      </div>

      <div className="mt-6 border-t border-line pt-6">
        {/* A mesma cotação da sacola, para uma peça. Antes isto era uma
            faixa de prazo inventada por região ("2 a 4 dias úteis") com
            preço nenhum — agora que existe motor de frete de verdade,
            manter o palpite ao lado dele seria mentir na página onde a
            decisão de compra acontece. */}
        <FreightCalculator items={[{ productId: product.id, quantity: 1 }]} />
      </div>

      <div className="mt-6 flex flex-col gap-2 border-t border-line pt-6 text-xs text-fg sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2">
        <span className="flex items-center gap-2">
          <Lock className="size-4 shrink-0 text-gold-text" aria-hidden="true" /> Compra segura
        </span>
        <span className="flex items-center gap-2">
          <ShieldCheck className="size-4 shrink-0 text-gold-text" aria-hidden="true" /> Dados protegidos
        </span>
        <span className="flex items-center gap-2">
          <RotateCcw className="size-4 shrink-0 text-gold-text" aria-hidden="true" /> Troca garantida
        </span>
      </div>
    </div>
  );
}
