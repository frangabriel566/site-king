import { z } from "zod";
import { imageUrlSchema } from "./image-url";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const homeSettingsSchema = z.object({
  eyebrow: optionalText(60),
  eyebrow_highlight: optionalText(30),
  headline: optionalText(120),
  headline_highlight: optionalText(40),
  subtitle: optionalText(300),
  cta_label: optionalText(40),
  cta_href: z
    .string()
    .trim()
    .max(300)
    .refine((value) => value === "" || value.startsWith("/") || /^https?:\/\//.test(value), {
      message: "O link do botão deve começar com / (página do site) ou https://",
    })
    .optional()
    .or(z.literal("")),
  whatsapp_label: optionalText(40),
  // z.guid(), not z.uuid() — see lib/validations/product.ts for why.
  featured_product_id: z.guid().optional().nullable(),
  featured_label: optionalText(80),
  hero_image_url: imageUrlSchema().optional().or(z.literal("")),
  kit_title: optionalText(80),
  kit_product_id: z.guid().optional().nullable(),
  kit_image_url: imageUrlSchema().optional().or(z.literal("")),
});

export type HomeSettingsInput = z.infer<typeof homeSettingsSchema>;
