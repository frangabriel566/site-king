import { ProductCard } from "./product-card";
import type { ProductListItem } from "@/lib/data/products";

export function ProductGrid({
  products,
  density = "compact",
}: {
  products: ProductListItem[];
  density?: "compact" | "comfortable";
}) {
  if (products.length === 0) return null;

  return (
    <div
      className={`grid grid-cols-2 gap-4 sm:grid-cols-2 lg:gap-5 ${
        density === "compact" ? "lg:grid-cols-4" : "lg:grid-cols-3"
      }`}
    >
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
