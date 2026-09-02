import type { Metadata } from "next";
import {
  getFilterOptions,
  getPriceRange,
  listProducts,
} from "@/lib/data/products";
import { getActiveCategories } from "@/lib/data/categories";
import { getActiveBrands } from "@/lib/data/brands";
import {
  parseCollectionParams,
  type CollectionSearchParams,
} from "@/lib/collection-params";
import { ProductGrid } from "@/components/shop/product-grid";
import { CollectionFilters } from "@/components/shop/collection-filters";
import { CollectionSort } from "@/components/shop/collection-sort";
import { DensityToggle } from "@/components/shop/density-toggle";
import { ActiveFilterChips } from "@/components/shop/active-filter-chips";
import { PaginationBar } from "@/components/shop/pagination-bar";
import { EmptyState } from "@/components/shop/empty-state";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";

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

  const [result, categories, brands, filterOptions, priceBounds] = await Promise.all([
    listProducts(filters),
    getActiveCategories(),
    getActiveBrands(),
    getFilterOptions(),
    getPriceRange(),
  ]);

  const activeCategory = categories.find((c) => c.slug === filters.category);
  const density = params.densidade === "confortavel" ? "comfortable" : "compact";

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-6 pb-16 md:px-8">
      <Breadcrumbs
        items={[
          { label: "Início", href: "/" },
          { label: "Coleção", href: activeCategory ? "/colecao" : undefined },
          ...(activeCategory ? [{ label: activeCategory.name }] : []),
        ]}
      />

      <h1 className="mt-4 mb-6 text-2xl font-bold text-fg md:text-3xl">
        {activeCategory ? activeCategory.name : "Todos os produtos"}
      </h1>

      <div className="flex flex-col gap-8 lg:flex-row">
        <CollectionFilters
          categories={categories}
          brands={brands}
          options={filterOptions}
          priceBounds={priceBounds}
        />

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {result.total} {result.total === 1 ? "produto" : "produtos"}
            </p>
            <div className="flex items-center gap-3">
              <DensityToggle />
              <CollectionSort />
            </div>
          </div>

          <ActiveFilterChips categories={categories} brands={brands} />

          {result.items.length === 0 ? (
            <EmptyState
              title="Nenhum produto encontrado"
              description="Tente ajustar os filtros ou buscar por outra categoria."
              actionLabel="Limpar filtros"
              actionHref="/colecao"
            />
          ) : (
            <>
              <ProductGrid products={result.items} density={density} />
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
