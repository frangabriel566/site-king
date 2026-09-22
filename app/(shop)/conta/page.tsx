import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyOrders } from "@/lib/data/orders";
import { getMyAddresses } from "@/lib/data/addresses";
import { AuthTabs } from "@/components/shop/auth-tabs";
import { AccountDashboard } from "./account-dashboard";

export const metadata: Metadata = { title: "Minha conta" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const supabase = await createClient();

  let user = null;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch (error) {
    // Same fail-open stance as middleware.ts: a broken Supabase client
    // shouldn't 500 the whole page — fall back to the logged-out view.
    console.error("conta: auth.getUser failed", error);
  }

  if (!user) {
    return (
      <div className="px-8 py-16 md:px-12">
        <div className="mx-auto max-w-sm">
          <h1 className="mb-8 text-2xl font-bold text-fg md:text-3xl">Minha conta</h1>
          {/* Sent here by /auth/callback when the link in the
              confirmation e-mail could not be redeemed — expired, already
              used, or opened in a different browser than it was requested
              from. Saying so beats dropping the shopper on a plain login
              box with no explanation. */}
          {erro === "confirmacao" && (
            <p className="mb-6 rounded-md border border-alert/30 bg-alert/5 px-4 py-3 text-sm text-fg">
              Não foi possível confirmar seu e-mail. O link pode ter expirado ou já
              ter sido usado. Tente entrar abaixo — se não funcionar, crie a conta
              novamente para receber um link novo.
            </p>
          )}
          <AuthTabs />
        </div>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // Admins land here too (same login box) if their session is already
  // active — send them straight to the panel instead of the customer view.
  if (profile?.role === "admin") {
    redirect("/admin");
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const [orders, addresses] = await Promise.all([getMyOrders(), getMyAddresses()]);

  return (
    <div className="px-8 py-16 md:px-12">
      <h1 className="mb-10 text-2xl font-bold text-fg md:text-3xl">Minha conta</h1>
      <AccountDashboard
        email={user.email ?? ""}
        customer={customer}
        orders={orders}
        addresses={addresses}
      />
    </div>
  );
}
