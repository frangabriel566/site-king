"use client";

import { useEffect, useRef } from "react";
import { SafeImage } from "@/components/shop/safe-image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { formatCurrency, formatInstallments } from "@/lib/format";
import { useFavorite } from "@/lib/hooks/use-favorite";
import { preloadGalleryImage, rememberCardImage } from "@/lib/image-handoff";
import type { ProductListItem } from "@/lib/data/products";

const BADGE_LABEL: Record<string, string> = {
  lancamento: "Lançamento",
  oferta: "Oferta",
  mais_vendido: "Mais vendido",
};

const LOW_STOCK_THRESHOLD = 3;

// How long the pointer has to rest on a card before its big photo is
// fetched: sweeping the mouse across the grid would otherwise start a
// download of several hundred KB for every card it crossed.
const HOVER_INTENT_MS = 100;

export function ProductCard({ product }: { product: ProductListItem }) {
  const { isFavorite, toggle } = useFavorite(product.id);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  // Gives the product page a head start on its photo. The route itself is
  // <Link>'s job — it prefetches in the viewport and again on hover/touch.
  function primeProductPage(link: HTMLAnchorElement, fetchPriority: "high" | "auto") {
    if (product.image) {
      rememberCardImage(
        product.slug,
        product.image.url,
        link.querySelector<HTMLImageElement>("img[data-card-photo]"),
      );
    }
    if (product.heroImage) preloadGalleryImage(product.heroImage, fetchPriority);
  }

  const badge = !product.inStock
    ? { label: "Esgotado", className: "bg-fg/80 text-white" }
    : product.badge
      ? { label: BADGE_LABEL[product.badge], className: "bg-gold text-fg" }
      : product.totalStock > 0 && product.totalStock <= LOW_STOCK_THRESHOLD
        ? { label: "Últimas unidades", className: "bg-alert text-white" }
        : product.compare_at_price
          ? { label: "Oferta", className: "bg-gold text-fg" }
          : null;

  return (
    <Link
      href={`/produto/${product.slug}`}
      className="group block overflow-hidden rounded-lg border border-line bg-white transition-[box-shadow,transform] duration-200 ease-out hover:shadow-lg active:scale-[0.98]"
      onMouseEnter={(event) => {
        const link = event.currentTarget;
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        hoverTimer.current = setTimeout(() => primeProductPage(link, "auto"), HOVER_INTENT_MS);
      }}
      onMouseLeave={() => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
      }}
      // A tap is ~100ms from touchstart to click, and the page is on its way
      // right after: no intent to wait for, and the photo should jump the
      // queue. onClick covers the keyboard and a click faster than the delay.
      onTouchStart={(event) => primeProductPage(event.currentTarget, "high")}
      onClick={(event) => primeProductPage(event.currentTarget, "high")}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-surface">
        {product.image ? (
          <>
            <SafeImage
              data-card-photo=""
              src={product.image.url}
              alt={product.image.alt ?? product.name}
              fill
              sizes="(min-width: 1024px) 23vw, 45vw"
              className={`object-cover transition-opacity duration-200 ease-out ${
                product.secondImage ? "group-hover:opacity-0" : ""
              }`}
            />
            {product.secondImage && (
              <SafeImage
                src={product.secondImage.url}
                alt={product.secondImage.alt ?? product.name}
                fill
                sizes="(min-width: 1024px) 23vw, 45vw"
                className="object-cover opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100"
              />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Sem imagem
          </div>
        )}

        {badge && (
          <span
            className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}
          >
            {badge.label}
          </span>
        )}

        <button
          type="button"
          onClick={toggle}
          aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          aria-pressed={isFavorite}
          // The circle stays 32px because a bigger one starts competing
          // with the photo, but a 32px tap target is well under a
          // fingertip — these are the dozens of little buttons that took
          // two or three presses each. The pseudo-element widens the hit
          // area to 44px without drawing anything, the same trade the
          // header icons make with padding.
          className="absolute right-2 top-2 flex size-8 touch-manipulation items-center justify-center rounded-full bg-white/90 text-fg shadow-sm transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-white"
        >
          <Heart
            className="size-4"
            fill={isFavorite ? "var(--alert)" : "none"}
            stroke={isFavorite ? "var(--alert)" : "currentColor"}
          />
        </button>
      </div>

      <div className="flex flex-col gap-1 p-3">
        {product.brand && (
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {product.brand.name}
          </p>
        )}
        <p className="line-clamp-2 min-h-[2.5em] text-[15px] font-semibold leading-tight text-fg">
          {product.name}
        </p>

        <div className="mt-1">
          {product.compare_at_price && (
            <p className="text-xs text-muted-foreground line-through">
              {formatCurrency(product.compare_at_price)}
            </p>
          )}
          <p className="text-xl font-bold text-price">{formatCurrency(product.price)}</p>
          {product.compare_at_price && (
            <p className="text-sm font-semibold text-discount">
              {formatCurrency(product.price)} no Pix
            </p>
          )}
          <p className="text-xs text-muted-foreground">{formatInstallments(product.price)}</p>
        </div>

        {product.colors.length > 0 && (
          <div className="mt-1 flex items-center gap-1.5">
            {product.colors.slice(0, 5).map((c) => (
              <span
                key={c.color}
                title={c.color}
                className="size-3 rounded-full border border-line"
                style={{ backgroundColor: c.color_hex ?? "#8A8A8A" }}
              />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
