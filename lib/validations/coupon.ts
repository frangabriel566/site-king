import { z } from "zod";

export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "Código muito curto")
      .max(40)
      .transform((v) => v.toUpperCase()),
    type: z.enum(["percent", "fixed"]),
    value: z.coerce.number().positive("Valor deve ser maior que zero"),
    min_total: z.coerce.number().min(0).default(0),
    active: z.boolean().default(true),
    expires_at: z.iso.datetime({ local: true }).optional().nullable().or(z.literal("")),
  })
  .refine((data) => data.type !== "percent" || data.value <= 100, {
    message: "Cupom percentual não pode passar de 100%",
    path: ["value"],
  });

export type CouponInput = z.infer<typeof couponSchema>;
