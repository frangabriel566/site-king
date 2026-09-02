import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import { updateProductAction } from "@/lib/actions/products";
import { getProductByIdAdmin, getAllVariantSkus } from "@/lib/data/products";
import { getAllCategoriesAdmin } from "@/lib/data/categories";
import { getAllBrandsAdmin } from "@/lib/data/brands";

export const metadata: Metadata = { title: "Editar produto — Painel" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, categories, brands] = await Promise.all([
    getProductByIdAdmin(id),
    getAllCategoriesAdmin(),
    getAllBrandsAdmin(),
  ]);

  if (!product) notFound();

  const existingSkus = await getAllVariantSkus(product.id);

  return (
    <div>
      <p className="text-label mb-2">Produtos</p>
      <h1 className="text-heading mb-8 text-3xl">Editar produto</h1>
      <ProductForm
        product={product}
        categories={categories}
        brands={brands}
        existingSkus={existingSkus}
        action={updateProductAction.bind(null, product.id)}
      />
    </div>
  );
}
