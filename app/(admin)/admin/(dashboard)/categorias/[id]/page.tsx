import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CategoryForm } from "@/components/admin/category-form";
import { updateCategoryAction } from "@/lib/actions/categories";

export const metadata: Metadata = { title: "Editar categoria — Painel" };

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: category } = await supabase
    .from("categories")
    .select("*")
    .eq("id", id)
    .maybeSingle();

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
