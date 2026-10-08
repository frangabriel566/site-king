import { headers } from "next/headers";
import { requireAdminPage } from "@/lib/auth/guards";
import { countPendingWhatsAppOrders } from "@/lib/data/whatsapp-orders";
import { getSiteSettings } from "@/lib/data/settings";
import { AdminSidebar } from "@/components/admin/sidebar";
import { Toaster } from "@/components/ui/sonner";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The real gate for every panel page: valid session *and* role = admin.
  // (middleware.ts only checks that a session cookie exists.) Every admin
  // data loader and Server Action checks again on its own.
  const next = (await headers()).get("x-pathname") ?? "/admin";
  const user = await requireAdminPage(next);

  // Um pedido de WhatsApp morre sozinho em 48h, então ficar esperando
  // que alguém abra a aba por conta própria é perder venda. O número
  // fica no menu, onde é visto de qualquer tela do painel.
  const [pendingWhatsApp, settings] = await Promise.all([
    countPendingWhatsAppOrders(),
    getSiteSettings(),
  ]);

  return (
    <div className="admin-theme min-h-dvh bg-bg text-fg md:flex">
      <AdminSidebar
        email={user.email}
        pendingWhatsApp={pendingWhatsApp}
        brand={{ logoUrl: settings.logo_url, name: settings.store_name }}
      />
      <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 md:px-10 md:py-8">
        {children}
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
}
