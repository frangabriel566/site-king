import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getAllCategoriesAdmin } from "@/lib/data/categories";
import { Button } from "@/components/ui/button";
import { CategoriesTable } from "./categories-table";

export const metadata: Metadata = { title: "Categorias — Painel" };

export default async function AdminCategoriesPage() {
  const categories = await getAllCategoriesAdmin();

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-label mb-2">Painel</p>
          <h1 className="text-heading text-3xl">Categorias</h1>
        </div>
        <Button asChild size="lg">
          <Link href="/admin/categorias/novo">
            <Plus className="size-4" /> Nova categoria
          </Link>
        </Button>
      </div>

      <CategoriesTable categories={categories} />
    </div>
  );
}
