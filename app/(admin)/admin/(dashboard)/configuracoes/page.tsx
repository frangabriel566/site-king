import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/data/settings";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata: Metadata = { title: "Configurações — Painel" };

export default async function AdminSettingsPage() {
  const settings = await getSiteSettings();

  return (
    <div>
      <p className="text-label mb-2">Painel</p>
      <h1 className="text-heading mb-8 text-3xl">Configurações</h1>
      <SettingsForm settings={settings} />
    </div>
  );
}
