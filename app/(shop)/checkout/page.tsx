import type { Metadata } from "next";
import { CheckoutWizard } from "@/components/shop/checkout-wizard";
import { isOnlineCheckoutAvailable } from "@/lib/payments";
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
  const params = await searchParams;
  const onlineAvailable = isOnlineCheckoutAvailable();

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
