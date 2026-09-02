"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { formatCurrency, formatInstallments } from "@/lib/format";
import { useFavorite } from "@/lib/hooks/use-favorite";
import type { ProductListItem } from "@/lib/data/products";

const BADGE_LABEL: Record<string, string> = {
  lancamento: "Lançamento",
  oferta: "Oferta",
  mais_vendido: "Mais vendido",
};

const LOW_STOCK_THRESHOLD = 3;

export function ProductCard({ product }: { product: ProductListItem }) {
  const { isFavorite, toggle } = useFavorite(product.id);

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
      className="group block overflow-hidden rounded-lg border border-line bg-white transition-shadow duration-200 ease-out hover:shadow-lg"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-surface">
        {product.image ? (
          <>
            <Image
              src={product.image.url}
              alt={product.image.alt ?? product.name}
              fill
              sizes="(min-width: 1024px) 23vw, (min-width: 640px) 45vw, 90vw"
              className={`object-cover transition-opacity duration-200 ease-out ${
                product.secondImage ? "group-hover:opacity-0" : ""
              }`}
            />
            {product.secondImage && (
              <Image
                src={product.secondImage.url}
                alt={product.secondImage.alt ?? product.name}
                fill
                sizes="(min-width: 1024px) 23vw, (min-width: 640px) 45vw, 90vw"
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
          className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-white/90 text-fg shadow-sm transition-colors hover:bg-white"
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
            <p className="text-xs font-medium text-discount">
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
