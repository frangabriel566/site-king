import "server-only";
import { MercadoPagoProvider } from "./mercadopago";
import { WhatsAppProvider } from "./whatsapp";
import { integrationState } from "@/lib/integrations";
import type { CheckoutMethod } from "@/lib/constants";
import type { PaymentProvider } from "./types";

export type { PaymentInitResult, PaymentItem, PaymentOrderInput, PaymentProvider } from "./types";

/**
 * Whether the store can actually take money online: Mercado Pago switched
 * on in Admin → Integrações (or, with nothing saved there, configured by
 * the old environment variables). Off, WhatsApp isn't one of two options,
 * it's the only way to close a sale, and the storefront must stop offering
 * a choice that would dead-end.
 */
export async function isOnlineCheckoutAvailable(): Promise<boolean> {
  return (await integrationState("mercadopago")).active;
}

/**
 * The shopper's pick, honoured only as far as the store can back it:
 * asking to pay online at a store with no online checkout falls through to
 * WhatsApp rather than handing back a payment URL that goes nowhere. The
 * return value is what gets written to `orders.payment_method`, so the
 * panel shows the route the order actually took.
 */
export function resolvePaymentMethod(
  method: CheckoutMethod | undefined,
  onlineAvailable: boolean,
): "mercadopago" | "whatsapp" {
  if (method === "whatsapp") return "whatsapp";
  return onlineAvailable ? "mercadopago" : "whatsapp";
}

export function getPaymentProvider(
  method: CheckoutMethod | undefined,
  onlineAvailable: boolean,
): PaymentProvider {
  return resolvePaymentMethod(method, onlineAvailable) === "whatsapp"
    ? new WhatsAppProvider()
    : new MercadoPagoProvider();
}
