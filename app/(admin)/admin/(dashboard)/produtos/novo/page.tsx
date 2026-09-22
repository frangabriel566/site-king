import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/product-form";
import { createProductAction } from "@/lib/actions/products";
import { getAllCategoriesAdmin } from "@/lib/data/categories";
import { getAllBrandsAdmin } from "@/lib/data/brands";
import { getAllProductSlugs, getAllVariantSkus } from "@/lib/data/products";

export const metadata: Metadata = { title: "Novo produto — Painel" };

type NewProductSearchParams = {
  categoria?: string;
  marca?: string;
};

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<NewProductSearchParams>;
}) {
  const [categories, brands, existingSkus, existingSlugs, params] = await Promise.all([
    getAllCategoriesAdmin(),
    getAllBrandsAdmin(),
    getAllVariantSkus(),
    getAllProductSlugs(),
    searchParams,
  ]);

  return (
    <div>
      <p className="text-label mb-2">Produtos</p>
      <h1 className="text-heading text-3xl">Novo produto</h1>
      <p className="mb-6 mt-2 text-sm text-ink-muted">
        Cadastre um produto em 4 etapas de forma rápida.
      </p>
      <ProductForm
        action={createProductAction}
        categories={categories}
        brands={brands}
        existingSkus={existingSkus}
        existingSlugs={existingSlugs}
        initialCategoryId={params.categoria}
        initialBrandId={params.marca}
      />
    </div>
  );
}
