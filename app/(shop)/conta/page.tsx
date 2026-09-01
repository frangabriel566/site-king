import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getMyOrders } from "@/lib/data/orders";
import { getMyAddresses } from "@/lib/data/addresses";
import { AuthTabs } from "@/components/shop/auth-tabs";
import { AccountDashboard } from "./account-dashboard";

export const metadata: Metadata = { title: "Minha conta" };

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="px-8 py-16 md:px-12">
        <div className="mx-auto max-w-sm">
          <h1 className="text-heading mb-8 text-4xl">Minha conta</h1>
          <AuthTabs />
        </div>
      </div>
    );
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const [orders, addresses] = await Promise.all([getMyOrders(), getMyAddresses()]);

  return (
    <div className="px-8 py-16 md:px-12">
      <h1 className="text-heading mb-10 text-4xl">Minha conta</h1>
      <AccountDashboard
        email={user.email ?? ""}
        customer={customer}
        orders={orders}
        addresses={addresses}
      />
    </div>
  );
}
