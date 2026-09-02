import type { Metadata } from "next";
import { BrandForm } from "@/components/admin/brand-form";
import { createBrandAction } from "@/lib/actions/brands";

export const metadata: Metadata = { title: "Nova marca — Painel" };

export default function NewBrandPage() {
  return (
    <div>
      <p className="text-label mb-2">Marcas</p>
      <h1 className="text-heading mb-8 text-3xl">Nova marca</h1>
      <BrandForm action={createBrandAction} />
    </div>
  );
}
