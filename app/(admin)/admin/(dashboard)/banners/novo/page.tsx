import type { Metadata } from "next";
import { BannerForm } from "@/components/admin/banner-form";
import { createBannerAction } from "@/lib/actions/banners";
import { getProductOptions } from "@/lib/data/products";

export const metadata: Metadata = { title: "Novo banner — Painel" };

export default async function NewBannerPage() {
  const productOptions = await getProductOptions();

  return (
    <div>
      <p className="text-label mb-2">Banners</p>
      <h1 className="text-heading mb-8 text-3xl">Novo banner</h1>
      <BannerForm action={createBannerAction} productOptions={productOptions} />
    </div>
  );
}
