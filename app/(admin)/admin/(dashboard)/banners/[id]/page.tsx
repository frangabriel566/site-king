import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BannerForm } from "@/components/admin/banner-form";
import { updateBannerAction } from "@/lib/actions/banners";
import { getBannerByIdAdmin } from "@/lib/data/banners";

export const metadata: Metadata = { title: "Editar banner — Painel" };

export default async function EditBannerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const banner = await getBannerByIdAdmin(id);
  if (!banner) notFound();

  return (
    <div>
      <p className="text-label mb-2">Banners</p>
      <h1 className="text-heading mb-8 text-3xl">Editar banner</h1>
      <BannerForm banner={banner} action={updateBannerAction.bind(null, banner.id)} />
    </div>
  );
}
