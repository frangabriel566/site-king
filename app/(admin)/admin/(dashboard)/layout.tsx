import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/sidebar";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen bg-[#0a0a0a] text-fg">
      <AdminSidebar email={user?.email ?? null} />
      <main className="min-w-0 flex-1 overflow-x-hidden px-8 py-8 md:px-10">
        {children}
      </main>
    </div>
  );
}
