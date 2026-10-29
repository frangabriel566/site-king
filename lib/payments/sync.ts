import "server-only";
import { getMercadoPagoCredentials } from "@/lib/integrations";
import {
  reconcileMercadoPagoPayment,
  type MercadoPagoPayment,
  type ReconcileOutcome,
} from "@/lib/payments/reconcile";

export type SyncOutcome = ReconcileOutcome | "not_found" | "not_configured" | "error";

/**
 * Pergunta ao Mercado Pago, pelo id do pedido (external_reference), se já
 * existe pagamento — sem depender do webhook chegar.
 *
 * O webhook é o caminho normal, mas se ele falhar (URL errada, assinatura,
 * fora do ar) o pedido ficava em "Aguardando pagamento" com o dinheiro já
 * na conta. Isto é chamado quando o cliente volta do Mercado Pago para
 * /pedido/[id] e pelo botão "Verificar pagamento" do painel. Idempotente:
 * usa o mesmo reconcile do webhook.
 */
export async function syncOrderPayment(orderId: string): Promise<SyncOutcome> {
  const credentials = await getMercadoPagoCredentials({ requireActive: false });
  if (!credentials) return "not_configured";

  try {
    const url = new URL("https://api.mercadopago.com/v1/payments/search");
    url.searchParams.set("external_reference", orderId);
    url.searchParams.set("sort", "date_created");
    url.searchParams.set("criteria", "desc");

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("[mercadopago sync] busca falhou", response.status, await response.text());
      return "error";
    }

    const data = (await response.json()) as { results?: MercadoPagoPayment[] };
    const results = (data.results ?? []).filter((p) => p.external_reference === orderId);
    if (results.length === 0) return "not_found";

    // Um pedido pode ter tentativas recusadas antes da aprovada.
    const payment = results.find((p) => p.status === "approved") ?? results[0];
    return await reconcileMercadoPagoPayment(payment);
  } catch (error) {
    console.error("[mercadopago sync]", error);
    return "error";
  }
}
