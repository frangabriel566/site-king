import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategoryByIdAdmin } from "@/lib/data/categories";
import { CategoryForm } from "@/components/admin/category-form";
import { updateCategoryAction } from "@/lib/actions/categories";

export const metadata: Metadata = { title: "Editar categoria — Painel" };

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const category = await getCategoryByIdAdmin(id);

  if (!category) notFound();

  return (
    <div>
      <p className="text-label mb-2">Categorias</p>
      <h1 className="text-heading mb-8 text-3xl">Editar categoria</h1>
      <CategoryForm
        category={category}
        action={updateCategoryAction.bind(null, category.id)}
      />
    </div>
  );
}
