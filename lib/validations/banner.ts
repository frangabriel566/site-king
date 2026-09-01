import { z } from "zod";

export const bannerSchema = z.object({
  eyebrow: z.string().trim().max(120).optional().or(z.literal("")),
  headline_line1: z.string().trim().max(80).optional().or(z.literal("")),
  headline_line2: z.string().trim().max(80).optional().or(z.literal("")),
  wordmark: z.string().trim().max(40).optional().or(z.literal("")),
  cta_label: z.string().trim().max(60).optional().or(z.literal("")),
  cta_href: z.string().trim().max(300).optional().or(z.literal("")),
  image_url: z.url("Envie a imagem de fundo").optional().or(z.literal("")),
  cutout_url: z.url().optional().or(z.literal("")),
  // z.guid(), not z.uuid() — see lib/validations/product.ts for why.
  featured_product_id: z.guid().optional().nullable(),
  active: z.boolean().default(false),
  position: z.coerce.number().int().min(0).default(0),
});

export type BannerInput = z.infer<typeof bannerSchema>;
