import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Nova senha" };

/**
 * Where the link in the reset e-mail ends up. Better Auth's
 * /api/auth/reset-password/<token> checks the token first and redirects
 * here with `?token=…`, or with `?error=INVALID_TOKEN` when it has expired
 * or was already used.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  return (
    <div className="px-8 py-16 md:px-12">
      <div className="mx-auto max-w-sm">
        <h1 className="mb-3 text-2xl font-bold text-fg md:text-3xl">Criar nova senha</h1>
        {token && !error ? (
          <>
            <p className="mb-8 text-sm text-ink-muted">
              Escolha uma senha com pelo menos 8 caracteres.
            </p>
            <ResetPasswordForm token={token} />
          </>
        ) : (
          <div className="flex flex-col gap-6">
            <p className="rounded-md border border-alert/30 bg-alert/5 px-4 py-3 text-sm text-fg">
              Este link expirou ou já foi usado. Os links valem por 1 hora e só funcionam uma vez.
            </p>
            <Link
              href="/esqueci-senha"
              className="text-sm font-medium text-fg underline underline-offset-4"
            >
              Pedir um novo link
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
