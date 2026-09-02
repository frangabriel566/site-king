import Link from "next/link";
import { ArrowRight, Tag } from "lucide-react";
import { ProductCard } from "./product-card";
import type { ProductListItem } from "@/lib/data/products";

function discountPercent(product: ProductListItem): number {
  if (!product.compare_at_price) return 0;
  return Math.round((1 - product.price / product.compare_at_price) * 100);
}

export function OffersBlock({ products }: { products: ProductListItem[] }) {
  if (products.length === 0) return null;

  const maxDiscount = Math.max(...products.map(discountPercent));

  return (
    <section className="bg-gold-soft/40">
      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="size-5 text-gold-text" aria-hidden="true" />
            <h2 className="text-xl font-bold text-fg md:text-2xl">
              Ofertas {maxDiscount > 0 ? `até ${maxDiscount}% off` : ""}
            </h2>
          </div>
          <Link
            href="/colecao"
            className="flex items-center gap-1 text-sm font-medium text-gold-text hover:underline"
          >
            Ver tudo <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {products.map((product) => (
            <div key={product.id} className="w-[45vw] shrink-0 sm:w-56 lg:w-64">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
