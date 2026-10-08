import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutWizard } from "@/components/shop/checkout-wizard";
import { getSiteSettings } from "@/lib/data/settings";
import { isOnlineCheckoutAvailable } from "@/lib/payments";
import { getSalesMode } from "@/lib/sales-mode";
import {
  CHECKOUT_METHOD_PARAM,
  isCheckoutMethod,
  type CheckoutMethod,
} from "@/lib/constants";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Closed (lib/sales-mode.ts): the bag closes the sale on WhatsApp, and an
  // old link or bookmark lands there instead of on a checkout that could
  // not charge the order. The wizard stays for when it opens again.
  if (!(await getSalesMode(await getSiteSettings())).checkoutOpen) redirect("/sacola");

  const params = await searchParams;
  const onlineAvailable = await isOnlineCheckoutAvailable();

  // A store with no online checkout has only one way to close a sale, so a
  // stale `?via=site` link resolves to WhatsApp rather than pre-selecting
  // an option the checkout could not honour anyway.
  const requested = params[CHECKOUT_METHOD_PARAM];
  const initialMethod: CheckoutMethod = !onlineAvailable
    ? "whatsapp"
    : isCheckoutMethod(requested)
      ? requested
      : "site";

  return (
    <div className="px-8 py-12 md:px-12">
      <h1 className="mb-10 text-2xl font-bold text-fg md:text-3xl">Checkout</h1>
      <CheckoutWizard onlineAvailable={onlineAvailable} initialMethod={initialMethod} />
    </div>
  );
}
