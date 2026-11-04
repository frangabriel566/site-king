import { z } from "zod";
import { BANNER_KINDS, MAX_BANNER_PHOTOS, bannerStyleSchema } from "@/lib/banner-style";
import { imageUrlSchema } from "./image-url";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const bannerSchema = z
  .object({
    kind: z.enum(BANNER_KINDS).default("editavel"),
    eyebrow: optionalText(120),
    eyebrow_highlight: optionalText(40),
    headline_line1: optionalText(120),
    headline_line2: optionalText(60),
    subtitle: optionalText(400),
    cta_label: optionalText(60),
    cta_href: optionalText(300),
    whatsapp_label: optionalText(60),
    show_whatsapp: z.boolean().default(true),
    badge: optionalText(80),
    image_url: imageUrlSchema().optional().or(z.literal("")),
    mobile_image_url: imageUrlSchema().optional().or(z.literal("")),
    extra_images: z
      .array(imageUrlSchema())
      .max(MAX_BANNER_PHOTOS - 1, `No máximo ${MAX_BANNER_PHOTOS} fotos por banner.`)
      .default([]),
    // Kept from the earlier banner form; the new one passes them through.
    wordmark: optionalText(40),
    cutout_url: imageUrlSchema().optional().or(z.literal("")),
    // z.guid(), not z.uuid() — see lib/validations/product.ts for why.
    featured_product_id: z.guid().optional().nullable(),
    style: bannerStyleSchema,
    active: z.boolean().default(false),
    position: z.coerce.number().int().min(0).default(0),
  })
  .refine((data) => data.kind !== "pronto" || data.image_url || data.mobile_image_url, {
    message: "Envie a imagem do banner pronto (celular ou computador).",
  });

export type BannerInput = z.infer<typeof bannerSchema>;
