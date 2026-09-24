import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AccountForm } from "@/components/admin/account-form";

export const metadata: Metadata = { title: "Conta — Painel" };

/** Lê a sessão a cada visita: o e-mail mostrado aqui é a credencial em
 *  vigor, e servir uma versão em cache dele seria mostrar ao operador um
 *  acesso que ele acabou de trocar. */
export const dynamic = "force-dynamic";

export default async function AdminAccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div>
      <p className="text-label mb-2">Painel</p>
      <h1 className="text-heading mb-2 text-3xl">Conta</h1>
      <p className="mb-8 max-w-2xl text-sm text-ink-muted">
        O e-mail e a senha com que você entra no painel. Isto é separado do
        e-mail de contato da loja, que fica em Configurações e aparece no
        rodapé do site.
      </p>

      {/* O middleware já barrou quem não é admin, então isto é só o
          compilador: `user` é tipado como possivelmente nulo. */}
      {user?.email ? (
        <AccountForm email={user.email} />
      ) : (
        <p className="text-sm text-ink-muted">
          Não foi possível ler sua sessão. Saia e entre de novo.
        </p>
      )}
    </div>
  );
}
