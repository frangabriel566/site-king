import { z } from "zod";
import { imageUrlSchema } from "./image-url";
import {
  ANNOUNCEMENT_MAX_LENGTH,
  ANNOUNCEMENT_MAX_MESSAGES,
  splitAnnouncement,
} from "@/lib/shop-config";

/** "399", "399,90" or "1.299,90" from a form field; empty means "not set". */
function parseFormNumber(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text === "") return null;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const number = Number(normalized);
  return Number.isNaN(number) ? text : number;
}

/** An optional number setting: empty clears it (the storefront then hides
 *  whatever it drives). */
function optionalNumber({
  min,
  max,
  integer = false,
  message,
}: {
  min: number;
  max: number;
  integer?: boolean;
  message: string;
}) {
  let schema = z.number({ error: message }).min(min, message).max(max, message);
  if (integer) schema = schema.int(message);
  return z.preprocess(parseFormNumber, schema.nullable());
}

export const siteSettingsSchema = z.object({
  store_name: z.string().trim().min(1, "Nome da loja obrigatório").max(120),
  logo_url: imageUrlSchema().optional().or(z.literal("")),
  whatsapp: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.email().optional().or(z.literal("")),
  instagram: z.string().trim().max(120).optional().or(z.literal("")),
  tiktok: z.string().trim().max(120).optional().or(z.literal("")),
  youtube: z.string().trim().max(120).optional().or(z.literal("")),
  shipping_note: z.string().trim().max(200).optional().or(z.literal("")),
  free_shipping_note: z.string().trim().max(200).optional().or(z.literal("")),
  // Uma mensagem por linha; a faixa do topo alterna entre elas. Guardado
  // já limpo (sem linhas vazias nem espaços sobrando).
  announcement: z
    .string()
    .nullish()
    .transform((value) => splitAnnouncement(value))
    .refine(
      (lines) => lines.length <= ANNOUNCEMENT_MAX_MESSAGES,
      `Faixa de avisos: no máximo ${ANNOUNCEMENT_MAX_MESSAGES} mensagens`,
    )
    .refine(
      (lines) => lines.every((line) => line.length <= ANNOUNCEMENT_MAX_LENGTH),
      `Faixa de avisos: cada mensagem pode ter até ${ANNOUNCEMENT_MAX_LENGTH} caracteres`,
    )
    .transform((lines) => lines.join("\n")),
  announcement_active: z.boolean().default(false),

  // Vitrine — regras de venda exibidas no card, na página do produto e na
  // sacola. Vazio = não exibir (nada aparece sem a loja ter definido).
  installments_max: optionalNumber({
    min: 2,
    max: 24,
    integer: true,
    message: "Parcelas sem juros: um número inteiro de 2 a 24",
  }),
  pix_discount_percent: optionalNumber({
    min: 0.5,
    max: 50,
    message: "Desconto no Pix: de 0,5% a 50%",
  }),
  free_shipping_threshold: optionalNumber({
    min: 1,
    max: 100000,
    message: "Frete grátis: informe um valor em reais maior que zero",
  }),
  new_product_days: optionalNumber({
    min: 1,
    max: 365,
    integer: true,
    message: 'Selo "Novo": um número de dias de 1 a 365',
  }),
  low_stock_units: optionalNumber({
    min: 1,
    max: 1000,
    integer: true,
    message: '"Últimas unidades": um número inteiro de peças, a partir de 1',
  }),
  exchange_note: z.string().trim().max(80).optional().or(z.literal("")),
  secure_purchase_note: z.string().trim().max(80).optional().or(z.literal("")),

  // Endereço de origem — de onde as encomendas saem. Alimenta a cotação
  // do Melhor Envio (só o CEP) e a etiqueta (o endereço inteiro + o
  // documento, que os Correios exigem na declaração). Tudo opcional no
  // schema: a loja funciona sem isso, apenas sem frete.
  origin_document: z.string().trim().max(20).optional().or(z.literal("")),
  // Guardado só com os oito dígitos: a cotação e a etiqueta normalizam
  // de novo antes de falar com o Melhor Envio, e um formato canônico no
  // banco evita que "64000-000" e "64000000" sejam valores diferentes.
  origin_cep: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ?? "").trim())
    // Validado na forma digitada — com ou sem hífen — para que um valor
    // sem nenhum dígito vire um erro visível, e não um campo apagado em
    // silêncio. Só depois vira a forma canônica.
    .refine((value) => value === "" || /^\d{5}-?\d{3}$/.test(value), "CEP inválido")
    .transform((value) => value.replace(/\D/g, "")),
  origin_street: z.string().trim().max(160).optional().or(z.literal("")),
  origin_number: z.string().trim().max(20).optional().or(z.literal("")),
  origin_complement: z.string().trim().max(120).optional().or(z.literal("")),
  origin_district: z.string().trim().max(120).optional().or(z.literal("")),
  origin_city: z.string().trim().max(120).optional().or(z.literal("")),
  origin_state: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, "Use a sigla do estado, ex: PI")
    .optional()
    .or(z.literal("")),
});

export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;
