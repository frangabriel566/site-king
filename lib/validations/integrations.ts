import { z } from "zod";
import { INTEGRATION_ENVIRONMENTS } from "@/lib/db/schema";

/** A token field: empty means "keep the saved one". Never logged. */
const tokenField = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || (value.length >= 20 && !/\s/.test(value)), {
      message: `${label}: cole o valor inteiro, sem espaços.`,
    })
    .transform((value) => value || null);

const environment = z.enum(INTEGRATION_ENVIRONMENTS, { error: "Escolha o ambiente." });

export const mercadoPagoFormSchema = z.object({
  environment,
  access_token: tokenField("Access Token"),
  webhook_secret: z
    .string()
    .trim()
    .refine((value) => value === "" || (value.length >= 16 && !/\s/.test(value)), {
      message: "Segredo do webhook: cole o valor inteiro, sem espaços.",
    })
    .transform((value) => value || null),
});

export const melhorEnvioFormSchema = z.object({
  environment,
  token: tokenField("Token"),
  email: z.email("Informe o e-mail de contato da conta Melhor Envio."),
});
