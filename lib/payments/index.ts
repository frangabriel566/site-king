import "server-only";
import { MercadoPagoProvider } from "./mercadopago";
import { WhatsAppProvider } from "./whatsapp";
import type { PaymentProvider } from "./types";

export type { PaymentInitResult, PaymentItem, PaymentOrderInput, PaymentProvider } from "./types";

export function getPaymentProvider(): PaymentProvider {
  const provider = process.env.PAYMENT_PROVIDER ?? "mercadopago";
  if (provider === "whatsapp") return new WhatsAppProvider();
  return new MercadoPagoProvider();
}
