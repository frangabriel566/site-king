import type { Metadata } from "next";
import {
  getFilterOptions,
  getPriceRange,
  listProducts,
} from "@/lib/data/products";
import { getActiveCategories } from "@/lib/data/categories";
import {
  parseCollectionParams,
  type CollectionSearchParams,
} from "@/lib/collection-params";
import { ProductGrid } from "@/components/shop/product-grid";
import { CollectionFilters } from "@/components/shop/collection-filters";
import { CollectionSort } from "@/components/shop/collection-sort";
import { PaginationBar } from "@/components/shop/pagination-bar";
import { EmptyState } from "@/components/shop/empty-state";

export const metadata: Metadata = {
  title: "Coleção",
  description: "Explore a coleção completa da King Store.",
};

export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<CollectionSearchParams>;
}) {
  const params = await searchParams;
  const filters = parseCollectionParams(params);

  const [result, categories, filterOptions, priceBounds] = await Promise.all([
    listProducts(filters),
    getActiveCategories(),
    getFilterOptions(),
    getPriceRange(),
  ]);

  const activeCategory = categories.find((c) => c.slug === filters.category);

  return (
    <div className="px-8 pt-12 pb-24 md:px-12">
      <div className="mb-12">
        <p className="text-label mb-3">Coleção</p>
        <h1 className="text-heading text-4xl sm:text-5xl">
          {activeCategory ? activeCategory.name : "Todos os produtos"}
        </h1>
      </div>

      <div className="flex flex-col gap-10 lg:flex-row">
        <CollectionFilters
          categories={categories}
          options={filterOptions}
          priceBounds={priceBounds}
        />

        <div className="flex-1">
          <div className="mb-8 flex items-center justify-between">
            <p className="text-label">
              {result.total} {result.total === 1 ? "produto" : "produtos"}
            </p>
            <CollectionSort />
          </div>

          {result.items.length === 0 ? (
            <EmptyState
              title="Nenhum produto encontrado"
              description="Tente ajustar os filtros ou buscar por outra categoria."
              actionLabel="Limpar filtros"
              actionHref="/colecao"
            />
          ) : (
            <>
              <ProductGrid products={result.items} />
              <PaginationBar
                page={result.page}
                totalPages={result.totalPages}
                searchParams={params}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
