import { createClient } from "@/lib/supabase/server";
import { countPendingWhatsAppOrders } from "@/lib/data/whatsapp-orders";
import { AdminSidebar } from "@/components/admin/sidebar";
import { Toaster } from "@/components/ui/sonner";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const [{ data: { user } }, pendingWhatsApp] = await Promise.all([
    supabase.auth.getUser(),
    // Um pedido de WhatsApp morre sozinho em 48h, então ficar esperando
    // que alguém abra a aba por conta própria é perder venda. O número
    // fica no menu, onde é visto de qualquer tela do painel.
    countPendingWhatsAppOrders(),
  ]);

  return (
    <div className="admin-theme min-h-dvh bg-bg text-fg md:flex">
      <AdminSidebar email={user?.email ?? null} pendingWhatsApp={pendingWhatsApp} />
      <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 md:px-10 md:py-8">
        {children}
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
}
