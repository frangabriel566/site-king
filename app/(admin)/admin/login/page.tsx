import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar — Painel",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-8 text-fg">
      <div className="w-full max-w-sm">
        <p className="text-sm font-extrabold uppercase tracking-[0.1em]">
          King Store
        </p>
        <h1 className="text-heading mt-2 text-3xl">Painel administrativo</h1>
        <p className="mt-3 text-sm text-ink-muted">
          Entre com sua conta de administrador.
        </p>
        <div className="mt-10">
          <LoginForm next={next} />
        </div>
      </div>
    </div>
  );
}
