import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { getCustomerForUser } from "@/lib/data/customers";
import { getMyOrders } from "@/lib/data/orders";
import { getMyAddresses } from "@/lib/data/addresses";
import { AuthTabs } from "@/components/shop/auth-tabs";
import { AccountDashboard } from "./account-dashboard";

export const metadata: Metadata = { title: "Minha conta" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ senha?: string }>;
}) {
  const { senha } = await searchParams;
  // Fails open: a broken auth setup shows the logged-out view, not a 500.
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="px-8 py-16 md:px-12">
        <div className="mx-auto max-w-sm">
          <h1 className="mb-8 text-2xl font-bold text-fg md:text-3xl">Minha conta</h1>
          {/* Sent here by /redefinir-senha after a successful reset, which
              ends every session — say so instead of dropping the shopper
              on a plain login box. */}
          {senha === "redefinida" && (
            <p
              role="status"
              className="mb-6 rounded-md border border-border bg-surface px-4 py-3 text-sm text-fg"
            >
              Senha alterada. Entre com a nova senha.
            </p>
          )}
          <AuthTabs />
        </div>
      </div>
    );
  }

  // Admins land here too (same login box) if their session is already
  // active — send them straight to the panel instead of the customer view.
  if (user.role === "admin") {
    redirect("/admin");
  }

  const [customer, orders, addresses] = await Promise.all([
    getCustomerForUser(user.id),
    getMyOrders(),
    getMyAddresses(),
  ]);

  return (
    <div className="px-8 py-16 md:px-12">
      <h1 className="mb-10 text-2xl font-bold text-fg md:text-3xl">Minha conta</h1>
      <AccountDashboard
        email={user.email}
        customer={customer}
        orders={orders}
        addresses={addresses}
      />
    </div>
  );
}
