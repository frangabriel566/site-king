import { z } from "zod";

// z.guid(), não z.uuid() — mesmo motivo de lib/validations/product.ts:
// os ids do seed não são v4 RFC-4122, mas são uuid válidos no Postgres.
export const whatsappOrderItemSchema = z.object({
  variantId: z.guid(),
  qty: z.number().int().min(1).max(99),
});

/** O que a vitrine manda ao pedir um código de WhatsApp. Nada de preço
 *  nem de nome: quem lê isso do banco é create_whatsapp_order(). */
export const whatsappOrderSchema = z.object({
  items: z.array(whatsappOrderItemSchema).min(1, "Sua sacola está vazia.").max(50),
});

/** Os dois botões da aba do painel. */
export const whatsappOrderIdSchema = z.object({
  order_id: z.guid(),
});

export type WhatsAppOrderInput = z.infer<typeof whatsappOrderSchema>;
