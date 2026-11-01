import {
  formatCep,
  formatCurrency,
  formatPhone,
  formatVariantLabel,
} from "@/lib/format";
import type {
  CustomerSnapshot,
  ShippingAddressSnapshot,
} from "@/lib/db/schema";

/**
 * O aviso que a loja recebe quando uma compra online é paga.
 *
 * Antes disso a única notificação era a do app do Mercado Pago, que diz
 * só "você recebeu R$ X": sem peça, sem tamanho, sem para onde mandar.
 * Esta mensagem tem o que é preciso para separar e despachar o pedido sem
 * abrir o painel — e o link para o painel quando for gerar a etiqueta.
 *
 * Função pura (sem rede) para ser testada; o envio está em telegram.ts.
 * Texto em HTML do Telegram, por isso tudo que vem do cliente é escapado.
 */

export type NewOrderAlertInput = {
  orderNumber: number;
  orderId: string;
  items: {
    name: string;
    color: string | null;
    size: string | null;
    qty: number;
    unitPrice: number;
  }[];
  subtotal: number;
  shipping: number;
  shippingMode: string;
  discount: number;
  couponCode: string | null;
  total: number;
  customer: CustomerSnapshot | null;
  address: ShippingAddressSnapshot | null;
  /** "Pix", "Cartão de crédito · 3x"… null quando o Mercado Pago não disse. */
  paymentLabel: string | null;
  origin: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** O jeito de pagar, em palavras, a partir do pagamento do Mercado Pago. */
export function describeMercadoPagoPayment(payment: {
  payment_type_id?: string | null;
  payment_method_id?: string | null;
  installments?: number | null;
}): string | null {
  const type = payment.payment_type_id;
  const method = payment.payment_method_id;
  if (method === "pix" || type === "bank_transfer") return "Pix";
  if (type === "ticket") return "Boleto";
  if (type === "credit_card") {
    const n = payment.installments ?? 1;
    return n > 1 ? `Cartão de crédito · ${n}x` : "Cartão de crédito · à vista";
  }
  if (type === "debit_card") return "Cartão de débito";
  if (type === "account_money") return "Saldo Mercado Pago";
  return null;
}

export function buildNewOrderAlert(input: NewOrderAlertInput): string {
  const e = escapeHtml;
  const lines: string[] = [];

  lines.push(`🛒 <b>NOVO PEDIDO PAGO — #${input.orderNumber}</b>`);
  lines.push(
    `💰 <b>${formatCurrency(input.total)}</b>${input.paymentLabel ? ` · ${e(input.paymentLabel)}` : ""}`,
  );
  lines.push("");

  const units = input.items.reduce((sum, item) => sum + item.qty, 0);
  lines.push(`📦 <b>Itens (${units} ${units === 1 ? "peça" : "peças"})</b>`);
  for (const item of input.items) {
    const variant = formatVariantLabel(item.color, item.size);
    lines.push(`• <b>${item.qty}x ${e(item.name)}</b>`);
    if (variant) lines.push(`   ${e(variant)}`);
    lines.push(
      `   ${item.qty} x ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.unitPrice * item.qty)}`,
    );
  }
  lines.push("");

  lines.push(`Produtos: ${formatCurrency(input.subtotal)}`);
  if (input.discount > 0) {
    lines.push(
      `Desconto${input.couponCode ? ` (${e(input.couponCode)})` : ""}: −${formatCurrency(input.discount)}`,
    );
  }
  const freight = input.address?.freight;
  const freightName = freight
    ? `${freight.company} ${freight.name}`.trim()
    : null;
  const freightValue =
    input.shippingMode === "free" || input.shipping <= 0
      ? "grátis"
      : input.shippingMode === "to_agree"
        ? "a combinar"
        : formatCurrency(input.shipping);
  lines.push(
    `Frete${freightName ? ` (${e(freightName)})` : ""}: ${freightValue}`,
  );
  if (freight?.days)
    lines.push(`Prazo da transportadora: ${freight.days} dias úteis`);
  lines.push(`<b>Total: ${formatCurrency(input.total)}</b>`);
  lines.push("");

  const c = input.customer;
  lines.push("👤 <b>Cliente</b>");
  lines.push(c?.name ? e(c.name) : "(sem nome)");
  if (c?.phone) {
    const digits = c.phone.replace(/\D/g, "");
    const local =
      digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
    lines.push(
      `📱 ${formatPhone(local)} — <a href="https://wa.me/55${local}">WhatsApp</a>`,
    );
  }
  if (c?.email) lines.push(`✉️ ${e(c.email)}`);
  lines.push("");

  const a = input.address;
  if (a) {
    lines.push("📍 <b>Entrega</b>");
    lines.push(
      e(`${a.street}, ${a.number}${a.complement ? ` — ${a.complement}` : ""}`),
    );
    lines.push(e(`${a.district} · ${a.city}/${a.state}`));
    lines.push(`CEP ${formatCep(a.cep)}`);
    lines.push("");
  }

  lines.push(
    `🔗 <a href="${input.origin}/admin/pedidos/${input.orderId}">Abrir pedido no painel</a>`,
  );

  return lines.join("\n");
}
