import Image from "next/image";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import type { ProductListItem } from "@/lib/data/products";

export function ProductCard({ product }: { product: ProductListItem }) {
  return (
    <Link href={`/produto/${product.slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-[#111111]">
        {product.image ? (
          <Image
            src={product.image.url}
            alt={product.image.alt ?? product.name}
            fill
            sizes="(min-width: 1024px) 23vw, (min-width: 640px) 45vw, 90vw"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-label">
            Sem imagem
          </div>
        )}
        {!product.inStock && (
          <span className="absolute left-3 top-3 border border-line bg-bg/80 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-ink-muted backdrop-blur-sm">
            Esgotado
          </span>
        )}
        {product.compare_at_price && product.inStock && (
          <span className="absolute left-3 top-3 bg-gold px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-black">
            Promoção
          </span>
        )}
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-fg">{product.name}</p>
          <div className="mt-1 flex items-center gap-2">
            {product.compare_at_price && (
              <span className="text-xs text-ink-muted line-through">
                {formatCurrency(product.compare_at_price)}
              </span>
            )}
            <span className="text-sm text-fg">
              {formatCurrency(product.price)}
            </span>
          </div>
        </div>
        {product.colors.length > 0 && (
          <div className="mt-1 flex items-center gap-1">
            {product.colors.slice(0, 4).map((c) => (
              <span
                key={c.color}
                title={c.color}
                className="size-2.5 rounded-full border border-line"
                style={{ backgroundColor: c.color_hex ?? "#8A8A8A" }}
              />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
