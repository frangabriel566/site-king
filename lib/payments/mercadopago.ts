import "server-only";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { roundMoney } from "@/lib/money";
import { getMercadoPagoCredentials } from "@/lib/integrations";
import type { PaymentInitResult, PaymentOrderInput, PaymentProvider } from "./types";

export class MercadoPagoProvider implements PaymentProvider {
  async createPayment(input: PaymentOrderInput): Promise<PaymentInitResult> {
    // Admin → Integrações first, the old environment variables as fallback.
    const credentials = await getMercadoPagoCredentials({ requireActive: true });
    if (!credentials) {
      throw new Error("Mercado Pago não está ativo.");
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const client = new MercadoPagoConfig({ accessToken: credentials.accessToken });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: preferenceItems(input),
        payer: {
          name: input.customerName,
          email: input.customerEmail,
        },
        external_reference: input.orderId,
        back_urls: {
          success: `${siteUrl}/pedido/${input.orderId}`,
          pending: `${siteUrl}/pedido/${input.orderId}`,
          failure: `${siteUrl}/pedido/${input.orderId}`,
        },
        auto_return: "approved",
        notification_url: `${siteUrl}/api/webhooks/mercadopago`,
        statement_descriptor: "KING STORE",
      },
    });

    // Teste opens the sandbox checkout, where test cards work.
    const url =
      credentials.environment === "test"
        ? (result.sandbox_init_point ?? result.init_point)
        : (result.init_point ?? result.sandbox_init_point);
    if (!url) {
      throw new Error("Mercado Pago não retornou um link de pagamento.");
    }

    return { kind: "mercadopago", url };
  }
}

/**
 * What Mercado Pago charges has to be the order's total. It used to be the
 * items alone, so the shipping was never charged and a coupon was never
 * taken off. A preference has no negative lines, so with a coupon the
 * products go as one line already discounted; the shipping is its own line.
 */
function preferenceItems(input: PaymentOrderInput) {
  const products =
    input.discount > 0
      ? [
          {
            id: `pedido-${input.orderNumber}`,
            title: `Pedido #${input.orderNumber}${input.couponCode ? ` (cupom ${input.couponCode})` : ""}`,
            quantity: 1,
            unit_price: roundMoney(input.subtotal - input.discount),
            currency_id: "BRL",
          },
        ]
      : input.items.map((item) => ({
          id: item.name,
          title: item.name,
          quantity: item.qty,
          unit_price: item.unitPrice,
          currency_id: "BRL",
        }));
  const shipping =
    input.shipping > 0
      ? [{ id: "frete", title: "Frete", quantity: 1, unit_price: input.shipping, currency_id: "BRL" }]
      : [];
  // A line at R$ 0,00 is refused by Mercado Pago (a 100% coupon).
  return [...products, ...shipping].filter((line) => line.unit_price > 0);
}
