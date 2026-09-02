import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/product-form";
import { createProductAction } from "@/lib/actions/products";
import { getAllCategoriesAdmin } from "@/lib/data/categories";
import { getAllBrandsAdmin } from "@/lib/data/brands";

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
  const [categories, brands, params] = await Promise.all([
    getAllCategoriesAdmin(),
    getAllBrandsAdmin(),
    searchParams,
  ]);

  return (
    <div>
      <p className="text-label mb-2">Produtos</p>
      <h1 className="text-heading mb-8 text-3xl">Novo produto</h1>
      <ProductForm
        action={createProductAction}
        categories={categories}
        brands={brands}
        initialCategoryId={params.categoria}
        initialBrandId={params.marca}
      />
    </div>
  );
}
