import { z } from "zod";

export const addressSchema = z.object({
  cep: z
    .string()
    .trim()
    .regex(/^\d{5}-?\d{3}$/, "CEP inválido"),
  street: z.string().trim().min(2, "Endereço obrigatório").max(200),
  number: z.string().trim().min(1, "Número obrigatório").max(20),
  complement: z.string().trim().max(120).optional().or(z.literal("")),
  district: z.string().trim().min(1, "Bairro obrigatório").max(120),
  city: z.string().trim().min(1, "Cidade obrigatória").max(120),
  state: z.string().trim().length(2, "Use a sigla do estado (ex: SP)"),
  is_default: z.boolean().default(false),
});

export type AddressInput = z.infer<typeof addressSchema>;
