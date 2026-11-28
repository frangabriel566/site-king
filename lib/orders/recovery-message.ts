/**
 * "Chamar no WhatsApp" para pedidos que o cliente começou e não fechou:
 * Mercado Pago sem pagamento, pedido do WhatsApp que ficou parado ou que
 * expirou. A mensagem é curta e pergunta o motivo com opções fáceis de
 * responder — o que travou é o que a loja precisa saber para salvar a venda.
 */

/** Status em que a compra ficou pela metade. */
export const RECOVERABLE_ORDER_STATUSES = ["pending", "aguardando_whatsapp", "expirado"] as const;

export function isRecoverableOrder(status: string): boolean {
  return (RECOVERABLE_ORDER_STATUSES as readonly string[]).includes(status);
}

/**
 * Número do cliente no formato do wa.me (55 + DDD + número). Aceita o
 * telefone como foi digitado no checkout, com ou sem máscara e com ou sem 55.
 * Devolve null quando não dá para montar um número brasileiro válido.
 */
export function customerWhatsAppNumber(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return null;
}

function firstName(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export type RecoveryMessageInput = {
  status: string;
  customerName?: string | null;
  storeName: string;
  orderCode: string;
  items: { name: string; qty: number }[];
  /** Total já formatado, ex.: "R$ 189,90". */
  total: string;
};

function itemsText(items: RecoveryMessageInput["items"]): string {
  const names = items.map((item) => (item.qty > 1 ? `${item.qty}x ${item.name}` : item.name));
  if (names.length <= 2) return names.join(" e ");
  return `${names.slice(0, 2).join(", ")} e mais ${names.length - 2} ${
    names.length - 2 === 1 ? "item" : "itens"
  }`;
}

export function buildRecoveryMessage(input: RecoveryMessageInput): string {
  const name = firstName(input.customerName);
  const greeting = name ? `Oi, ${name}! Tudo bem?` : "Oi! Tudo bem?";
  const products = itemsText(input.items);

  const context =
    input.status === "pending"
      ? `Aqui é da ${input.storeName}. Vi que você começou a compra de ${products} (pedido #${input.orderCode}, ${input.total}), mas o pagamento não foi concluído.`
      : input.status === "expirado"
        ? `Aqui é da ${input.storeName}. Seu pedido #${input.orderCode} com ${products} (${input.total}) acabou expirando antes de a gente fechar a compra.`
        : `Aqui é da ${input.storeName}. Vi que você separou ${products} (pedido #${input.orderCode}, ${input.total}), mas a compra ainda não foi finalizada.`;

  return [
    greeting,
    "",
    context,
    "",
    "Aconteceu alguma coisa? Pode me contar o que te fez parar, assim consigo te ajudar:",
    "1️⃣ Valor do frete ou prazo de entrega",
    "2️⃣ Problema na hora de pagar (Pix ou cartão)",
    "3️⃣ Dúvida sobre tamanho, cor ou produto",
    "4️⃣ Achou o preço alto / quer desconto",
    "5️⃣ Só desistiu ou vai comprar depois",
    "",
    "É só responder com o número ou me contar aqui. Se ainda quiser as peças, eu te ajudo a fechar agora mesmo! 😊",
  ].join("\n");
}

export function buildRecoveryLink(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
