import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "./product-card";
import { ScrollRail } from "./scroll-rail";
import type { ProductListItem } from "@/lib/data/products";

export function ProductRail({
  title,
  products,
  seeAllHref,
  tag,
}: {
  title: string;
  products: ProductListItem[];
  seeAllHref?: string;
  /** A short highlight beside the title, e.g. "até 40% off". */
  tag?: string | null;
}) {
  if (products.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex flex-wrap items-baseline gap-x-2 text-xl font-bold text-fg md:text-2xl">
          {title}
          {/* The space keeps "Ofertas até 17% off" two words for a screen
              reader; the flex gap is what spaces them on screen. */}
          {tag && (
            <>
              {" "}
              <span className="text-sm font-bold uppercase text-discount md:text-base">{tag}</span>
            </>
          )}
        </h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="flex items-center gap-1 text-sm font-medium text-gold-text hover:underline"
          >
            Ver tudo <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      <ScrollRail className="gap-4 pb-2" label={title}>
        {products.map((product) => (
          <div key={product.id} className="w-[45vw] shrink-0 sm:w-56 lg:w-64">
            <ProductCard product={product} />
          </div>
        ))}
      </ScrollRail>
    </section>
  );
}
