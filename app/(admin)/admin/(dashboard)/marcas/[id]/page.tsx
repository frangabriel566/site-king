import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBrandByIdAdmin } from "@/lib/data/brands";
import { BrandForm } from "@/components/admin/brand-form";
import { updateBrandAction } from "@/lib/actions/brands";

export const metadata: Metadata = { title: "Editar marca — Painel" };

export default async function EditBrandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const brand = await getBrandByIdAdmin(id);

  if (!brand) notFound();

  return (
    <div>
      <p className="text-label mb-2">Marcas</p>
      <h1 className="text-heading mb-8 text-3xl">Editar marca</h1>
      <BrandForm brand={brand} action={updateBrandAction.bind(null, brand.id)} />
    </div>
  );
}
