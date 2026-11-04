import type { Metadata } from "next";
import { BannerForm } from "@/components/admin/banner-form";
import { createBannerAction } from "@/lib/actions/banners";

export const metadata: Metadata = { title: "Novo banner — Painel" };

export default function NewBannerPage() {
  return (
    <div>
      <p className="text-label mb-2">Banners</p>
      <h1 className="text-heading mb-8 text-3xl">Novo banner</h1>
      <BannerForm action={createBannerAction} />
    </div>
  );
}
