import "server-only";
import type { SiteSettings } from "@/lib/data/settings";
import { getCurrentUser } from "@/lib/auth/guards";
import { integrationState } from "@/lib/integrations";
import { isValidCep } from "@/lib/shipping/package";

/**
 * The checkout quotes Melhor Envio and charges the option picked (Etapa
 * 3). Kept as a switch: false puts the store back on WhatsApp-only, with
 * the Integrações switches still saved, without touching the panel.
 */
const QUOTE_CHECKOUT_READY = true;

export type SalesMode = {
  /** The CEP box ("Calcular frete e prazo") quotes Melhor Envio for real. */
  freightQuotes: boolean;
  /** The full checkout (login, address, freight, online payment) is open.
   * Closed, "Finalizar compra" creates the WhatsApp order straight from the
   * bag, and /checkout sends the shopper back there. */
  checkoutOpen: boolean;
  /** Each service as switched on in Admin → Integrações (or by the old
   * environment variables), whatever the store does with it yet. */
  mercadoPagoActive: boolean;
  melhorEnvioActive: boolean;
  /** Mercado Pago is on with test credentials: the checkout opens only for
   * an admin signed in, so the store can be tested end to end with test
   * cards while every customer keeps buying on WhatsApp. */
  checkoutTestOnly: boolean;
};

/**
 * How the store sells right now — derived from what is configured and
 * switched on, so turning an integration off in the panel puts the store
 * back on WhatsApp with no deploy.
 *
 * Melhor Envio counts as on with a usable origin CEP (Configurações) as
 * well: without it every quote fails. The checkout needs online payment
 * *and* a freight it can charge, so it opens with both services — and,
 * while Mercado Pago runs on test credentials, only for an admin.
 */
export async function getSalesMode(settings: Pick<SiteSettings, "origin_cep">): Promise<SalesMode> {
  const [mercadoPago, melhorEnvio] = await Promise.all([
    integrationState("mercadopago"),
    integrationState("melhorenvio"),
  ]);
  const melhorEnvioActive = melhorEnvio.active && isValidCep(settings.origin_cep ?? "");
  const freightQuotes = QUOTE_CHECKOUT_READY && melhorEnvioActive;
  const bothOn = freightQuotes && mercadoPago.active;
  // A sandbox payment is no payment: test credentials must never reach a
  // real customer. With them, only an admin sees the checkout.
  const checkoutTestOnly = bothOn && mercadoPago.environment === "test";
  const checkoutOpen = checkoutTestOnly
    ? (await getCurrentUser())?.role === "admin"
    : bothOn;
  return {
    freightQuotes,
    checkoutOpen,
    mercadoPagoActive: mercadoPago.active,
    melhorEnvioActive,
    checkoutTestOnly,
  };
}
