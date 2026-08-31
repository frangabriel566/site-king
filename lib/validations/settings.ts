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
});

export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;
