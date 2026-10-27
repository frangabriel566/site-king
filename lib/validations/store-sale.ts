import { z } from "zod";
import { STORE_PAYMENT_METHODS } from "@/lib/store-sales/payment-methods";
import { BIRTHDAY_MESSAGE_MAX } from "@/lib/store-sales/birthday";
import { customerPhoneSchema } from "@/lib/validations/whatsapp-order";

/** Teto por venda, igual ao da compra pelo WhatsApp. */
export const STORE_SALE_MAX_LINES = 50;

export const storeSaleItemSchema = z.object({
  variantId: z.guid(),
  qty: z.coerce.number().int().min(1, "Quantidade mínima: 1.").max(999),
  /** Editable at the counter (a balcão discount); starts at the site price. */
  unitPrice: z.coerce.number().min(0, "Preço não pode ser negativo.").max(1_000_000),
});

/** "Dar baixa" (Vendas na loja → Nova baixa). */
export const storeSaleSchema = z.object({
  items: z
    .array(storeSaleItemSchema)
    .min(1, "Adicione pelo menos uma peça.")
    .max(STORE_SALE_MAX_LINES, `No máximo ${STORE_SALE_MAX_LINES} peças diferentes por venda.`),
  discount: z.coerce.number().min(0, "Desconto não pode ser negativo.").default(0),
  paymentMethod: z.enum(STORE_PAYMENT_METHODS, { message: "Escolha a forma de pagamento." }),
  /** Dinheiro: what the customer handed over, for the change. Optional. */
  cashReceived: z.coerce
    .number()
    .min(0, "Valor recebido não pode ser negativo.")
    .max(1_000_000)
    .nullable()
    .optional()
    .default(null),
  customerId: z.guid().nullable().optional().default(null),
  note: z
    .string()
    .trim()
    .max(500, "Observação com no máximo 500 caracteres.")
    .optional()
    .transform((value) => value || null),
});

export type StoreSaleInput = z.infer<typeof storeSaleSchema>;

/** Editing a sale (Histórico de baixas → Editar). */
export const storeSaleUpdateSchema = storeSaleSchema.extend({
  sale_id: z.guid(),
  // Lines whose piece left the catalogue stay on the sale as they were, so
  // the editable ones may be none (lib/store-sales/sales.ts).
  items: z
    .array(storeSaleItemSchema)
    .max(STORE_SALE_MAX_LINES, `No máximo ${STORE_SALE_MAX_LINES} peças diferentes por venda.`),
  /** Keep the name of a customer deleted from the book since the sale. */
  keepCustomerName: z.boolean().optional().default(false),
});

export type StoreSaleUpdateInput = z.infer<typeof storeSaleUpdateSchema>;

export const storeSaleIdSchema = z.object({ sale_id: z.guid() });

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Name required; phone and birthday optional. */
export const storeCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Digite o nome do cliente.")
    .max(80, "Nome com no máximo 80 caracteres."),
  phone: customerPhoneSchema.optional().default(""),
  birthdate: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((value) => value === "" || isRealDate(value), { message: "Data de nascimento inválida." })
    .refine((value) => value === "" || (value >= "1900-01-01" && value <= new Date().toISOString().slice(0, 10)), {
      message: "Data de nascimento inválida.",
    })
    .transform((value) => value || null),
});

export type StoreCustomerInput = z.infer<typeof storeCustomerSchema>;

export const storeCustomerIdSchema = z.object({ customer_id: z.guid() });

export const birthdayMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .max(BIRTHDAY_MESSAGE_MAX, `Mensagem com no máximo ${BIRTHDAY_MESSAGE_MAX} caracteres.`),
});
