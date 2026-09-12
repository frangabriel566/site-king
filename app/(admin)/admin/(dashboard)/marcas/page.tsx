import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getAllBrandsAdmin } from "@/lib/data/brands";
import { Button } from "@/components/ui/button";
import { BrandsTable } from "./brands-table";

export const metadata: Metadata = { title: "Marcas — Painel" };

export default async function AdminBrandsPage() {
  const brands = await getAllBrandsAdmin();

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-label mb-2">Painel</p>
          <h1 className="text-heading text-3xl">Marcas</h1>
        </div>
        <Button asChild size="lg">
          <Link href="/admin/marcas/novo">
            <Plus className="size-4" /> Nova marca
          </Link>
        </Button>
      </div>

      <BrandsTable brands={brands} />
    </div>
  );
}
