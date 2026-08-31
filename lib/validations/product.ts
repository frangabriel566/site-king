import { z } from "zod";

const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const productVariantSchema = z.object({
  id: z.uuid().optional(),
  color: z.string().trim().min(1, "Cor obrigatória").max(60),
  color_hex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use um hex válido, ex: #0A0A0A")
    .optional()
    .or(z.literal("")),
  size: z.string().trim().min(1, "Tamanho obrigatório").max(20),
  sku: z.string().trim().max(80).optional().or(z.literal("")),
  stock: z.coerce.number().int().min(0, "Estoque não pode ser negativo").default(0),
});

export const productImageSchema = z.object({
  id: z.uuid().optional(),
  url: z.url("URL de imagem inválida"),
  alt: z.string().trim().max(200).optional().or(z.literal("")),
  position: z.coerce.number().int().min(0).default(0),
});

export const productSchema = z
  .object({
    name: z.string().trim().min(2, "Nome muito curto").max(160),
    slug: z
      .string()
      .trim()
      .min(2, "Slug muito curto")
      .max(160)
      .regex(slugRegex, "Use apenas letras minúsculas, números e hífen"),
    description: z.string().trim().max(4000).optional().or(z.literal("")),
    price: z.coerce.number().positive("Preço deve ser maior que zero"),
    compare_at_price: z.coerce.number().positive().optional().nullable(),
    category_id: z.uuid("Selecione uma categoria"),
    status: z.enum(["draft", "active", "archived"]).default("draft"),
    featured: z.boolean().default(false),
    position: z.coerce.number().int().min(0).default(0),
    images: z.array(productImageSchema).default([]),
    variants: z.array(productVariantSchema).min(1, "Adicione ao menos uma variação"),
  })
  .refine(
    (data) =>
      !data.compare_at_price || data.compare_at_price > data.price,
    {
      message: "O preço 'de' deve ser maior que o preço atual",
      path: ["compare_at_price"],
    },
  );

export type ProductInput = z.infer<typeof productSchema>;
export type ProductVariantInput = z.infer<typeof productVariantSchema>;
export type ProductImageInput = z.infer<typeof productImageSchema>;
