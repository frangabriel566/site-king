import { z } from "zod";

export const reviewSchema = z.object({
  product_id: z.string().uuid(),
  rating: z.coerce.number().int().min(1, "Escolha uma nota de 1 a 5").max(5),
  comment: z.string().trim().max(1000, "Máximo de 1000 caracteres").optional().or(z.literal("")),
});

export type ReviewInput = z.infer<typeof reviewSchema>;
