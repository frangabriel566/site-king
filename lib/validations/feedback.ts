import { z } from "zod";
import { imageUrlSchema } from "./image-url";

export const FEEDBACK_MAX_IMAGES = 10;
export const FEEDBACK_TEXT_MAX = 1000;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

/** A form number: empty means "not set". */
function formNumber(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" ? null : Number(text);
}

export const feedbackImageSchema = z.object({
  url: imageUrlSchema("Imagem inválida"),
  kind: z.enum(["photo", "chat"]).default("photo"),
  width: z.number().int().positive().nullish(),
  height: z.number().int().positive().nullish(),
});

export const feedbackSchema = z
  .object({
    customer_name: z.string().trim().min(2, "Informe o nome do cliente").max(80),
    customer_location: optionalText(60),
    text: optionalText(FEEDBACK_TEXT_MAX),
    rating: z.preprocess(
      formNumber,
      z.number({ error: "Nota inválida" }).int().min(1, "Nota de 1 a 5").max(5, "Nota de 1 a 5").nullable(),
    ),
    // z.guid(), not z.uuid() — the seed ids are not RFC-4122 v4.
    product_id: z
      .string()
      .trim()
      .nullish()
      .transform((value) => value || null)
      .pipe(z.guid("Produto inválido").nullable()),
    show_on_home: z.boolean().default(false),
    active: z.boolean().default(true),
    position: z.preprocess(
      formNumber,
      z.number({ error: "Ordem inválida" }).int("A ordem é um número inteiro").min(1, "A ordem começa em 1").nullable(),
    ),
    feedback_date: z
      .union([z.iso.date({ error: "Data inválida" }), z.literal(""), z.null()])
      .optional()
      .transform((value) => value || null),
    images: z
      .array(feedbackImageSchema)
      .max(FEEDBACK_MAX_IMAGES, `No máximo ${FEEDBACK_MAX_IMAGES} imagens por feedback`)
      .default([]),
  })
  // Spans two tables in the database, so it lives here rather than in a
  // CHECK: a feedback is something to read or something to look at.
  .refine((data) => Boolean(data.text) || data.images.length > 0, {
    message: "O feedback precisa de um texto ou de pelo menos uma imagem",
    path: ["text"],
  });

export type FeedbackInput = z.infer<typeof feedbackSchema>;
