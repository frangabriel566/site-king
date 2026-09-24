import { z } from "zod";

// z.guid(), não z.uuid() — mesmo motivo de lib/validations/product.ts:
// os ids do seed não são v4 RFC-4122, mas são uuid válidos no Postgres.
export const whatsappOrderItemSchema = z.object({
  variantId: z.guid(),
  // `coerce` porque a quantidade vem do localStorage: uma sacola gravada
  // como `"2"` por qualquer versão anterior é uma venda, não um defeito.
  // Continua estrito no que importa — "abc" vira NaN e cai no int(), e
  // null vira 0 e cai no min(1).
  qty: z.coerce.number().int().min(1).max(99),
});

export type WhatsAppOrderItemInput = z.infer<typeof whatsappOrderItemSchema>;

/** Teto grosseiro, igual ao da função do banco. */
const MAX_ITEMS = 50;

/**
 * Lê a sacola que a vitrine mandou, linha por linha.
 *
 * Deliberadamente **não** é um `safeParse` de tudo ou nada. A sacola vem
 * do `localStorage`, que ninguém valida na leitura (`readStoredCart` faz
 * um `JSON.parse` e confia): basta uma linha gravada por uma versão
 * antiga do site para o schema inteiro falhar. Antes, isso rejeitava a
 * compra *e* mostrava o texto cru do Zod ao cliente — "Invalid GUID",
 * "Invalid input: expected number, received string". Ninguém compra de
 * uma loja que responde isso.
 *
 * Agora a linha ruim cai fora, o resto da sacola vale, e `dropped` avisa
 * a vitrine para dizer em português o que aconteceu. Só quando não sobra
 * nada é que a compra para.
 */
export function parseWhatsAppItems(input: unknown): {
  items: WhatsAppOrderItemInput[];
  dropped: boolean;
} {
  const raw = (input as { items?: unknown } | null | undefined)?.items;
  if (!Array.isArray(raw)) return { items: [], dropped: false };

  const items: WhatsAppOrderItemInput[] = [];
  let dropped = raw.length > MAX_ITEMS;

  for (const entry of raw.slice(0, MAX_ITEMS)) {
    const parsed = whatsappOrderItemSchema.safeParse(entry);
    if (parsed.success) items.push(parsed.data);
    else dropped = true;
  }

  return { items, dropped };
}

/** Os dois botões da aba do painel. */
export const whatsappOrderIdSchema = z.object({
  order_id: z.guid(),
});
