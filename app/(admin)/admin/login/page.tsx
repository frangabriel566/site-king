import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { getSiteSettings } from "@/lib/data/settings";
import { StoreLogo } from "@/components/store-logo";
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

  // Already signed in as an admin: straight into the panel.
  const user = await getCurrentUser();
  if (user?.role === "admin") {
    redirect(next?.startsWith("/admin") ? next : "/admin");
  }
  const settings = await getSiteSettings();

  return (
    <div className="admin-theme flex min-h-dvh items-center justify-center bg-bg px-8 text-fg">
      <div className="w-full max-w-sm">
        <StoreLogo
          logoUrl={settings.logo_url}
          name={settings.store_name}
          imageClassName="h-10 max-w-[220px]"
          textClassName="text-sm font-extrabold uppercase tracking-[0.1em]"
        />
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
