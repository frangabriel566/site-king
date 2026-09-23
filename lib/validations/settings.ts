import { z } from "zod";

export const siteSettingsSchema = z.object({
  store_name: z.string().trim().min(1, "Nome da loja obrigatório").max(120),
  logo_url: z.url().optional().or(z.literal("")),
  whatsapp: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.email().optional().or(z.literal("")),
  instagram: z.string().trim().max(120).optional().or(z.literal("")),
  tiktok: z.string().trim().max(120).optional().or(z.literal("")),
  youtube: z.string().trim().max(120).optional().or(z.literal("")),
  shipping_note: z.string().trim().max(200).optional().or(z.literal("")),
  free_shipping_note: z.string().trim().max(200).optional().or(z.literal("")),
  announcement: z.string().trim().max(240).optional().or(z.literal("")),
  announcement_active: z.boolean().default(false),

  // Endereço de origem — de onde as encomendas saem. Alimenta a cotação
  // do Melhor Envio (só o CEP) e a etiqueta (o endereço inteiro + o
  // documento, que os Correios exigem na declaração). Tudo opcional no
  // schema: a loja funciona sem isso, apenas sem frete.
  origin_document: z.string().trim().max(20).optional().or(z.literal("")),
  origin_cep: z
    .string()
    .trim()
    .regex(/^d{5}-?d{3}$/, "CEP inválido")
    .optional()
    .or(z.literal("")),
  origin_street: z.string().trim().max(160).optional().or(z.literal("")),
  origin_number: z.string().trim().max(20).optional().or(z.literal("")),
  origin_complement: z.string().trim().max(120).optional().or(z.literal("")),
  origin_district: z.string().trim().max(120).optional().or(z.literal("")),
  origin_city: z.string().trim().max(120).optional().or(z.literal("")),
  origin_state: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, "Use a sigla do estado, ex: PI")
    .optional()
    .or(z.literal("")),
});

export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;
