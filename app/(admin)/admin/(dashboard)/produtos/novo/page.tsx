import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/product-form";
import { createProductAction } from "@/lib/actions/products";
import { getAllCategoriesAdmin } from "@/lib/data/categories";

export const metadata: Metadata = { title: "Novo produto — Painel" };

export default async function NewProductPage() {
  const categories = await getAllCategoriesAdmin();

  return (
    <div>
      <p className="text-label mb-2">Produtos</p>
      <h1 className="text-heading mb-8 text-3xl">Novo produto</h1>
      <ProductForm action={createProductAction} categories={categories} />
    </div>
  );
}
