import { ProductCard } from "./product-card";
import type { ProductListItem } from "@/lib/data/products";

export function ProductGrid({ products }: { products: ProductListItem[] }) {
  if (products.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
