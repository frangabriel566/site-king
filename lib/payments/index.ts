import "server-only";
import { MercadoPagoProvider } from "./mercadopago";
import { WhatsAppProvider } from "./whatsapp";
import type { CheckoutMethod } from "@/lib/constants";
import type { PaymentProvider } from "./types";

export type { PaymentInitResult, PaymentItem, PaymentOrderInput, PaymentProvider } from "./types";

/**
 * Whether the store can actually take money online. `PAYMENT_PROVIDER=whatsapp`
 * is how a store says it has no online checkout configured — then WhatsApp
 * isn't one of two options, it's the only way to close a sale, and the
 * storefront must stop offering a choice that would dead-end.
 */
export function isOnlineCheckoutAvailable(): boolean {
  return (process.env.PAYMENT_PROVIDER ?? "mercadopago") !== "whatsapp";
}

/**
 * The shopper's pick, honoured only as far as the store can back it:
 * asking to pay online at a store with no online checkout falls through to
 * WhatsApp rather than handing back a payment URL that goes nowhere. The
 * return value is what gets written to `orders.payment_method`, so the
 * panel shows the route the order actually took.
 */
export function resolvePaymentMethod(method?: CheckoutMethod): "mercadopago" | "whatsapp" {
  if (method === "whatsapp") return "whatsapp";
  return isOnlineCheckoutAvailable() ? "mercadopago" : "whatsapp";
}

export function getPaymentProvider(method?: CheckoutMethod): PaymentProvider {
  return resolvePaymentMethod(method) === "whatsapp"
    ? new WhatsAppProvider()
    : new MercadoPagoProvider();
}
