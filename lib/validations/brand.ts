import { z } from "zod";

export const brandSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(80),
  slug: z
    .string()
    .trim()
    .min(2, "Slug muito curto")
    .max(80)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífen"),
  logo_url: z.url().nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  position: z.coerce.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export type BrandInput = z.infer<typeof brandSchema>;
