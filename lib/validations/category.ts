import { z } from "zod";
import { imageUrlSchema } from "./image-url";
import { normalizeSizeGuide } from "@/lib/size-guide";

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(80),
  slug: z
    .string()
    .trim()
    .min(2, "Slug muito curto")
    .max(80)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífen"),
  position: z.coerce.number().int().min(0).default(0),
  active: z.boolean().default(true),
  /** Null: the storefront uses the first product's photo instead. */
  image_url: imageUrlSchema().nullable().optional(),
  // The editor submits the table as JSON in a hidden field; empty means
  // "no guide". Normalized here so blank rows/columns never get stored.
  size_guide: z
    .string()
    .nullish()
    .transform((value, ctx) => {
      if (!value?.trim()) return null;
      try {
        return normalizeSizeGuide(JSON.parse(value));
      } catch {
        ctx.addIssue({ code: "custom", message: "Tabela de medidas inválida" });
        return z.NEVER;
      }
    }),
});

export type CategoryInput = z.infer<typeof categorySchema>;
