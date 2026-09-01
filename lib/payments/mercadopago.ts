import "server-only";
import { MercadoPagoConfig, Preference } from "mercadopago";
import type { PaymentInitResult, PaymentOrderInput, PaymentProvider } from "./types";

export class MercadoPagoProvider implements PaymentProvider {
  async createPayment(input: PaymentOrderInput): Promise<PaymentInitResult> {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado.");
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: input.items.map((item) => ({
          id: item.name,
          title: item.name,
          quantity: item.qty,
          unit_price: item.unitPrice,
          currency_id: "BRL",
        })),
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

    const url = result.init_point ?? result.sandbox_init_point;
    if (!url) {
      throw new Error("Mercado Pago não retornou um link de pagamento.");
    }

    return { kind: "mercadopago", url };
  }
}
