import { z } from "zod";

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
});

export type CategoryInput = z.infer<typeof categorySchema>;
