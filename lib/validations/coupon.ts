import { z } from "zod";
import { normalizeCouponCode } from "@/lib/coupons/rules";

/** "10", "10,5" or "1.299,90" from a form field. */
function formNumber(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  if (text === "") return undefined;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const number = Number(normalized);
  return Number.isNaN(number) ? text : number;
}

const optionalDate = z
  .union([z.iso.date({ error: "Data inválida" }), z.literal(""), z.null()])
  .optional()
  .transform((value) => value || null);

export const couponSchema = z
  .object({
    // Saved exactly as the storefront compares it: no spaces, upper case
    // (lib/coupons/rules.ts normalizes what the shopper types the same way).
    code: z
      .string()
      .transform(normalizeCouponCode)
      .pipe(
        z
          .string()
          .min(3, "Código muito curto (mínimo 3 caracteres)")
          .max(40, "Código muito longo (máximo 40 caracteres)")
          .regex(/^[A-Z0-9_-]+$/, "Use só letras, números, hífen ou sublinhado"),
      ),
    // "free_shipping" is a form choice, not a stored type: it is saved as a
    // fixed R$ 0 coupon that also zeroes the freight (see the transform).
    type: z.enum(["percent", "fixed", "free_shipping"], { error: "Escolha o tipo do desconto" }),
    value: z.preprocess(
      formNumber,
      z.number({ error: "Informe o valor do desconto" }).min(0).optional(),
    ),
    min_total: z.preprocess(formNumber, z.number({ error: "Pedido mínimo inválido" }).min(0).default(0)),
    max_uses: z.preprocess(
      formNumber,
      z
        .number({ error: "Limite de usos inválido" })
        .int("O limite de usos é um número inteiro")
        .min(1, "O limite de usos é de pelo menos 1")
        .nullable()
        .default(null),
    ),
    starts_at: optionalDate,
    expires_at: optionalDate,
    free_shipping: z.boolean().default(false),
    one_per_phone: z.boolean().default(false),
    active: z.boolean().default(true),
  })
  .transform(({ type, value, free_shipping, ...rest }) =>
    type === "free_shipping"
      ? { ...rest, type: "fixed" as const, value: 0, free_shipping: true }
      : { ...rest, type, value: value ?? Number.NaN, free_shipping },
  )
  .refine((data) => Number.isFinite(data.value), {
    message: "Informe o valor do desconto",
    path: ["value"],
  })
  .refine((data) => data.type !== "percent" || data.value <= 100, {
    message: "Cupom percentual não pode passar de 100%",
    path: ["value"],
  })
  // A coupon has to give something: a discount, free shipping, or both.
  .refine((data) => data.value > 0 || data.free_shipping, {
    message: "Informe um desconto maior que zero ou marque frete grátis",
    path: ["value"],
  })
  .refine((data) => !data.starts_at || !data.expires_at || data.expires_at >= data.starts_at, {
    message: "A data final não pode ser antes da inicial",
    path: ["expires_at"],
  });

export type CouponInput = z.infer<typeof couponSchema>;
