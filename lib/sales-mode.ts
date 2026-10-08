import "server-only";
import type { SiteSettings } from "@/lib/data/settings";
import { integrationState } from "@/lib/integrations";
import { isValidCep } from "@/lib/shipping/package";

/**
 * The checkout's freight quote (Etapa 3) isn't in the store yet. Until it
 * is, the Integrações switches are saved and tested, but the store keeps
 * selling on WhatsApp with the freight agreed there — a checkout with no
 * freight to charge would only be a longer road to the same order.
 */
const QUOTE_CHECKOUT_READY = false;

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
};

/**
 * How the store sells right now — derived from what is configured and
 * switched on, so turning an integration off in the panel puts the store
 * back on WhatsApp with no deploy.
 *
 * Melhor Envio counts as on with a usable origin CEP (Configurações) as
 * well: without it every quote fails. The checkout needs online payment
 * *and* a freight it can charge, so it opens with both services.
 */
export async function getSalesMode(settings: Pick<SiteSettings, "origin_cep">): Promise<SalesMode> {
  const [mercadoPago, melhorEnvio] = await Promise.all([
    integrationState("mercadopago"),
    integrationState("melhorenvio"),
  ]);
  const melhorEnvioActive = melhorEnvio.active && isValidCep(settings.origin_cep ?? "");
  const freightQuotes = QUOTE_CHECKOUT_READY && melhorEnvioActive;
  return {
    freightQuotes,
    checkoutOpen: freightQuotes && mercadoPago.active,
    mercadoPagoActive: mercadoPago.active,
    melhorEnvioActive,
  };
}
