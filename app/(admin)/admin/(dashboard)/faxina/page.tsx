import type { Metadata } from "next";
import { ImageCleanup } from "@/components/admin/image-cleanup";
import { requireAdminPage } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Faxina de imagens — Painel" };

export default async function AdminImageCleanupPage() {
  await requireAdminPage();
  return (
    <div className="max-w-3xl">
      <p className="text-label mb-2">Painel</p>
      <h1 className="text-heading mb-2 text-3xl">Faxina de imagens</h1>
      <p className="mb-8 text-sm text-ink-muted">
        Fotos guardadas que nenhum produto, banner, categoria, marca, logo ou
        feedback usa mais: de exclusões antigas, trocas de imagem ou
        formulários que não foram salvos. Primeiro a análise só mostra; nada é
        apagado sem você confirmar. Fotos enviadas nas últimas 24 horas ficam
        de fora, porque podem estar num formulário ainda aberto.
      </p>
      <ImageCleanup />
    </div>
  );
}
