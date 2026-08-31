import { z } from "zod";
import { addressSchema } from "./address";

export const checkoutContactSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(160),
  email: z.email("E-mail inválido"),
  phone: z
    .string()
    .trim()
    .refine((v) => {
      const digits = v.replace(/\D/g, "");
      return digits.length === 10 || digits.length === 11;
    }, "Telefone inválido"),
});

export const checkoutItemSchema = z.object({
  variant_id: z.uuid(),
  qty: z.coerce.number().int().positive(),
});

export const checkoutSchema = z.object({
  contact: checkoutContactSchema,
  address: addressSchema,
  shipping_method: z.enum(["standard", "express"]),
  coupon_code: z.string().trim().max(40).optional().or(z.literal("")),
  items: z.array(checkoutItemSchema).min(1, "Sacola vazia"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CheckoutContactInput = z.infer<typeof checkoutContactSchema>;
export type CheckoutItemInput = z.infer<typeof checkoutItemSchema>;

export const cepLookupSchema = z.object({
  cep: z.string().trim().regex(/^\d{5}-?\d{3}$/, "CEP inválido"),
});
