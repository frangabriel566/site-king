import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/guards";
import { AccountForm } from "@/components/admin/account-form";

export const metadata: Metadata = { title: "Conta — Painel" };

/** Lê a sessão a cada visita: o e-mail mostrado aqui é a credencial em
 *  vigor, e servir uma versão em cache dele seria mostrar ao operador um
 *  acesso que ele acabou de trocar. */
export const dynamic = "force-dynamic";

export default async function AdminAccountPage() {
  const user = await requireAdminPage("/admin/conta");

  return (
    <div>
      <p className="text-label mb-2">Painel</p>
      <h1 className="text-heading mb-2 text-3xl">Conta</h1>
      <p className="mb-8 max-w-2xl text-sm text-ink-muted">
        O e-mail e a senha com que você entra no painel. Isto é separado do
        e-mail de contato da loja, que fica em Configurações e aparece no
        rodapé do site.
      </p>

      <AccountForm email={user.email} />
    </div>
  );
}
