import type { Metadata } from "next";
import { CategoryForm } from "@/components/admin/category-form";
import { createCategoryAction } from "@/lib/actions/categories";

export const metadata: Metadata = { title: "Nova categoria — Painel" };

export default function NewCategoryPage() {
  return (
    <div>
      <p className="text-label mb-2">Categorias</p>
      <h1 className="text-heading mb-8 text-3xl">Nova categoria</h1>
      <CategoryForm action={createCategoryAction} />
    </div>
  );
}
