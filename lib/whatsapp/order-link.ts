import "server-only";
import { formatCurrency, formatDateTime, formatVariantLabel } from "@/lib/format";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * O número da loja, só dígitos, como o wa.me exige.
 *
 * Uma fonte só para os dois caminhos que abrem conversa a partir de um
 * pedido — a compra direta (lib/actions/whatsapp-orders) e o checkout
 * finalizado no WhatsApp (lib/payments/whatsapp) — porque um número
 * salvo no painel e outro lido do env é o tipo de divergência que só
 * aparece quando um cliente reclama que ninguém respondeu.
 *
 * `null`, e não uma exceção, quando não há número: a vitrine usa isso
 * para simplesmente não oferecer o botão.
 */
export async function getStoreWhatsAppNumber(): Promise<string | null> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("site_settings")
    .select("whatsapp")
    .eq("id", 1)
    .maybeSingle();

  const phone = (data?.whatsapp ?? process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(
    /\D/g,
    "",
  );

  return phone || null;
}

export type WhatsAppOrderItem = {
  name: string;
  slug: string;
  color: string | null;
  size: string | null;
  qty: number;
  unitPrice: number;
};

/**
 * A mensagem que o cliente manda para a loja.
 *
 * Ela é o pedido: o atendente não precisa abrir o painel para saber o
 * que foi escolhido, e o cliente vê exatamente o que ficou registrado.
 * Por isso cada linha carrega o link do produto — é o que permite ao
 * atendente conferir a peça (e ao cliente mostrar a outra pessoa) sem
 * ninguém ter de descrever "o moletom preto, aquele".
 *
 * O `*` do WhatsApp deixa código e total em negrito. Nada aqui é
 * codificado para URL: quem faz isso é buildWhatsAppOrderLink().
 */
export function buildWhatsAppOrderMessage({
  storeName,
  code,
  items,
  total,
  expiresAt,
  origin,
}: {
  storeName: string;
  code: string;
  items: WhatsAppOrderItem[];
  total: number;
  expiresAt: string | null;
  origin: string;
}): string {
  const lines: string[] = [
    `Olá! Quero fechar este pedido na ${storeName}.`,
    "",
    `Pedido *#${code}*`,
    "",
  ];

  items.forEach((item, index) => {
    // formatVariantLabel devolve null para o par sentinela de "produto
    // sem variações", então uma peça única não ganha uma linha "Padrão · U"
    // que não quer dizer nada para o cliente.
    const variant = formatVariantLabel(item.color, item.size);

    lines.push(`${index + 1}) ${item.name}`);
    if (variant) lines.push(`   ${variant}`);
    lines.push(
      `   ${item.qty} x ${formatCurrency(item.unitPrice)} = ${formatCurrency(
        item.unitPrice * item.qty,
      )}`,
    );
    lines.push(`   ${origin}/produto/${item.slug}`);
    lines.push("");
  });

  lines.push(`*Total: ${formatCurrency(total)}*`);

  if (expiresAt) {
    lines.push("");
    // "Reservado" seria mentira: este status não baixa nem segura
    // estoque. O que expira é o código, e é isso que a frase diz.
    lines.push(`Este código vale até ${formatDateTime(expiresAt)}.`);
  }

  return lines.join("\n");
}

export function buildWhatsAppOrderLink(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
