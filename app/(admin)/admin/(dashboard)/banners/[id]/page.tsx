import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BannerForm } from "@/components/admin/banner-form";
import { updateBannerAction } from "@/lib/actions/banners";
import { getBannerByIdAdmin } from "@/lib/data/banners";
import { getProductOptions } from "@/lib/data/products";

export const metadata: Metadata = { title: "Editar banner — Painel" };

export default async function EditBannerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [banner, productOptions] = await Promise.all([
    getBannerByIdAdmin(id),
    getProductOptions(),
  ]);

  if (!banner) notFound();

  return (
    <div>
      <p className="text-label mb-2">Banners</p>
      <h1 className="text-heading mb-8 text-3xl">Editar banner</h1>
      <BannerForm
        banner={banner}
        action={updateBannerAction.bind(null, banner.id)}
        productOptions={productOptions}
      />
    </div>
  );
}
