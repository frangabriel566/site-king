import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/sidebar";
import { Toaster } from "@/components/ui/sonner";

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
    <div className="min-h-screen bg-[#0a0a0a] text-fg md:flex">
      <AdminSidebar email={user?.email ?? null} />
      <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 md:px-10 md:py-8">
        {children}
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
}
