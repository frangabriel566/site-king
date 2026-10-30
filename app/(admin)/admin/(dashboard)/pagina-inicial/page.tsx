import type { Metadata } from "next";
import { HomeSettingsForm } from "@/components/admin/home-settings-form";
import { HOME_DEFAULTS, getHomeSettingsAdmin } from "@/lib/data/home";
import { getProductOptions } from "@/lib/data/products";

export const metadata: Metadata = { title: "Página inicial — Painel" };

export default async function AdminHomePage() {
  const [home, productOptions] = await Promise.all([
    getHomeSettingsAdmin(),
    getProductOptions(),
  ]);

  return (
    <div>
      <p className="text-label mb-2">Painel</p>
      <h1 className="text-heading mb-2 text-3xl">Página inicial</h1>
      <p className="mb-8 max-w-2xl text-sm text-ink-muted">
        Textos do topo da home e o produto do card sobre a foto. Um campo salvo
        vazio volta ao texto padrão.
      </p>
      <HomeSettingsForm
        row={home.row}
        defaults={HOME_DEFAULTS}
        productOptions={productOptions}
        autoPrice={null}
      />
    </div>
  );
}
