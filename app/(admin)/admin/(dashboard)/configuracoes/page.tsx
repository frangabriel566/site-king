import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSettings } from "@/lib/data/settings";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata: Metadata = { title: "Configurações — Painel" };

export default async function AdminSettingsPage() {
  const settings = await getSiteSettings();

  return (
    <div>
      <p className="text-label mb-2">Painel</p>
      <h1 className="text-heading mb-2 text-3xl">Configurações</h1>
      {/* O "E-mail" deste formulário é o de contato da loja, que sai no
          rodapé do site — não o de login. Os dois já foram confundidos,
          então o caminho para o outro fica dito aqui. */}
      <p className="mb-8 max-w-2xl text-sm text-ink-muted">
        Dados da loja. Para trocar o e-mail ou a senha com que você entra no
        painel, vá em{" "}
        <Link href="/admin/conta" className="text-accent-light hover:underline">
          Conta
        </Link>
        .
      </p>
      <SettingsForm settings={settings} />
    </div>
  );
}
