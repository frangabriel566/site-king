import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/product-form";
import { createProductAction } from "@/lib/actions/products";
import { getAllCategoriesAdmin } from "@/lib/data/categories";

export const metadata: Metadata = { title: "Novo produto — Painel" };

type NewProductSearchParams = {
  categoria?: string;
  std_weight_grams?: string;
  std_length_cm?: string;
  std_width_cm?: string;
  std_height_cm?: string;
};

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<NewProductSearchParams>;
}) {
  const [categories, params] = await Promise.all([getAllCategoriesAdmin(), searchParams]);

  const initialStandardMeasurements = {
    weight_grams: params.std_weight_grams ? Number(params.std_weight_grams) : null,
    length_cm: params.std_length_cm ? Number(params.std_length_cm) : null,
    width_cm: params.std_width_cm ? Number(params.std_width_cm) : null,
    height_cm: params.std_height_cm ? Number(params.std_height_cm) : null,
  };

  return (
    <div>
      <p className="text-label mb-2">Produtos</p>
      <h1 className="text-heading mb-8 text-3xl">Novo produto</h1>
      <ProductForm
        action={createProductAction}
        categories={categories}
        initialCategoryId={params.categoria}
        initialStandardMeasurements={initialStandardMeasurements}
      />
    </div>
  );
}
