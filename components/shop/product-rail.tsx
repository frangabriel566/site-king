import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "./product-card";
import type { ProductListItem } from "@/lib/data/products";

export function ProductRail({
  title,
  products,
  seeAllHref,
}: {
  title: string;
  products: ProductListItem[];
  seeAllHref?: string;
}) {
  if (products.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-fg md:text-2xl">{title}</h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="flex items-center gap-1 text-sm font-medium text-gold-text hover:underline"
          >
            Ver tudo <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {products.map((product) => (
          <div key={product.id} className="w-[45vw] shrink-0 sm:w-56 lg:w-64">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}
