import "server-only";
import type { SiteSettings } from "@/lib/data/settings";
import { isOnlineCheckoutAvailable } from "@/lib/payments";
import { isMelhorEnvioConfigured } from "@/lib/shipping/melhor-envio";
import { isValidCep } from "@/lib/shipping/package";

export type SalesMode = {
  /** The CEP box ("Calcular frete e prazo") quotes Melhor Envio for real. */
  freightQuotes: boolean;
  /** The full checkout (login, address, freight, online payment) is open.
   * Closed, "Finalizar compra" creates the WhatsApp order straight from the
   * bag, and /checkout sends the shopper back there. */
  checkoutOpen: boolean;
};

/**
 * How the store sells right now — derived from what is configured, so
 * there is no switch to forget in the panel.
 *
 * The freight quote needs the three Melhor Envio variables and a usable
 * origin CEP (Configurações): without any of them every quote fails, so
 * the box is hidden instead of answering with an error.
 *
 * The checkout needs online payment *and* a freight it can charge: with
 * the freight agreed on WhatsApp there is no total to take online, and a
 * checkout ending on WhatsApp would only be a longer road to the order the
 * bag already creates. So it opens with Mercado Pago and Melhor Envio
 * together — the latter only alongside the checkout quote task.
 */
export function getSalesMode(settings: Pick<SiteSettings, "origin_cep">): SalesMode {
  const freightQuotes = isMelhorEnvioConfigured() && isValidCep(settings.origin_cep ?? "");
  return { freightQuotes, checkoutOpen: freightQuotes && isOnlineCheckoutAvailable() };
}
