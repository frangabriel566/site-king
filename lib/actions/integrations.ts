"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb, schema } from "@/lib/db";
import { getSiteSettings } from "@/lib/data/settings";
import { getActiveProductsMissingPackage } from "@/lib/data/integrations";
import type { IntegrationEnvironment, IntegrationProvider } from "@/lib/db/schema";
import {
  IntegrationKeyMissingError,
  decryptSecrets,
  encryptSecrets,
  secretHint,
} from "@/lib/integrations/crypto";
import { MELHOR_ENVIO_HOSTS } from "@/lib/integrations";
import { testMelhorEnvio, testMercadoPago } from "@/lib/integrations/test-connection";
import { isValidCep } from "@/lib/shipping/package";
import { melhorEnvioFormSchema, mercadoPagoFormSchema } from "@/lib/validations/integrations";

export type IntegrationFormResult = { status: "idle" | "error" | "success"; message?: string };
export type IntegrationActionResult = { ok: boolean; message: string };

const { integrations, integration_log } = schema;

const PROVIDER_LABEL: Record<IntegrationProvider, string> = {
  mercadopago: "Mercado Pago",
  melhorenvio: "Melhor Envio",
};

const ENVIRONMENT_LABEL: Record<IntegrationEnvironment, string> = {
  test: "Teste",
  production: "Produção",
};

const KEY_MISSING =
  "Falta a chave de criptografia (secret INTEGRATIONS_KEY) no Cloudflare. Sem ela os tokens não podem ser guardados.";

function revalidate() {
  revalidatePath("/admin/integracoes");
  // The storefront is rendered per request; the layout reads the mode.
  revalidatePath("/", "layout");
}

async function getRow(provider: IntegrationProvider) {
  const [row] = await getDb().select().from(integrations).where(eq(integrations.provider, provider));
  return row ?? null;
}

/**
 * Writes a provider's credentials. Fields left empty keep what was saved;
 * anything that changes turns the integration off and clears the last
 * test, so "Ativo" always refers to credentials that were tested.
 */
async function saveCredentials(
  provider: IntegrationProvider,
  input: {
    environment: IntegrationEnvironment;
    secrets: Record<string, string | null>;
    options?: Record<string, string>;
  },
  required: string[],
): Promise<IntegrationFormResult> {
  const user = await requireAdmin();
  const row = await getRow(provider);

  let current: Record<string, string> = {};
  try {
    if (row?.secrets) current = await decryptSecrets(provider, row.secrets);
  } catch (error) {
    if (error instanceof IntegrationKeyMissingError) return { status: "error", message: KEY_MISSING };
    // A key that changed since: the saved tokens are unreadable, so every
    // token has to be typed again.
    current = {};
  }

  const replaced = Object.entries(input.secrets).filter(([, value]) => value);
  const merged: Record<string, string> = { ...current };
  for (const [field, value] of replaced) merged[field] = value!;
  const missing = required.find((field) => !merged[field]);
  if (missing) {
    return { status: "error", message: "Cole o token para salvar." };
  }

  const optionsChanged =
    JSON.stringify(input.options ?? {}) !== JSON.stringify(row?.options ?? {});
  const environmentChanged = row?.environment !== input.environment;
  if (row?.secrets && replaced.length === 0 && !optionsChanged && !environmentChanged) {
    return { status: "success", message: "Nada mudou." };
  }

  let secrets: string;
  try {
    secrets = await encryptSecrets(provider, merged);
  } catch (error) {
    if (error instanceof IntegrationKeyMissingError) return { status: "error", message: KEY_MISSING };
    throw error;
  }

  const hints = Object.fromEntries(Object.entries(merged).map(([field, value]) => [field, secretHint(value)]));
  const now = new Date().toISOString();
  const values = {
    environment: input.environment,
    secrets,
    hints,
    options: input.options ?? null,
    active: false,
    test_ok: false,
    tested_at: null,
    test_message: null,
    updated_at: now,
    updated_by: user.email,
  };

  const what = [
    replaced.length > 0 ? `tokens salvos (${replaced.map(([field]) => field).join(", ")})` : null,
    environmentChanged ? `ambiente ${ENVIRONMENT_LABEL[input.environment]}` : null,
    optionsChanged && provider === "melhorenvio" ? "e-mail de contato" : null,
  ]
    .filter(Boolean)
    .join("; ");

  const db = getDb();
  await db.batch([
    db
      .insert(integrations)
      .values({ provider, ...values })
      .onConflictDoUpdate({ target: integrations.provider, set: values }),
    db.insert(integration_log).values({
      provider,
      action: `Credenciais alteradas: ${what}${row?.active ? " — desativado até um novo teste" : ""}`,
      actor_email: user.email,
    }),
  ]);
  revalidate();
  return {
    status: "success",
    message: "Salvo. Teste a conexão para poder ativar.",
  };
}

export async function saveMercadoPagoAction(
  _prev: IntegrationFormResult,
  formData: FormData,
): Promise<IntegrationFormResult> {
  const parsed = mercadoPagoFormSchema.safeParse({
    environment: formData.get("environment"),
    access_token: formData.get("access_token") ?? "",
    webhook_secret: formData.get("webhook_secret") ?? "",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };
  return saveCredentials(
    "mercadopago",
    {
      environment: parsed.data.environment,
      secrets: { access_token: parsed.data.access_token, webhook_secret: parsed.data.webhook_secret },
    },
    ["access_token"],
  );
}

export async function saveMelhorEnvioAction(
  _prev: IntegrationFormResult,
  formData: FormData,
): Promise<IntegrationFormResult> {
  const parsed = melhorEnvioFormSchema.safeParse({
    environment: formData.get("environment"),
    token: formData.get("token") ?? "",
    email: formData.get("email"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };
  return saveCredentials(
    "melhorenvio",
    {
      environment: parsed.data.environment,
      secrets: { token: parsed.data.token },
      options: { email: parsed.data.email },
    },
    ["token"],
  );
}

/** "Testar conexão": a real call with the saved credentials. The result
 * (never a token) is kept on the row and in the log. */
export async function testIntegrationAction(
  provider: IntegrationProvider,
): Promise<IntegrationActionResult> {
  const user = await requireAdmin();
  const row = await getRow(provider);
  if (!row?.secrets) return { ok: false, message: "Salve as credenciais antes de testar." };

  let secrets: Record<string, string>;
  try {
    secrets = await decryptSecrets(provider, row.secrets);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof IntegrationKeyMissingError
          ? KEY_MISSING
          : "Não foi possível ler os tokens salvos (a chave de criptografia mudou?). Substitua o token.",
    };
  }

  const result =
    provider === "mercadopago"
      ? await testMercadoPago({
          accessToken: secrets.access_token ?? "",
          webhookSecret: secrets.webhook_secret ?? null,
          environment: row.environment,
        })
      : await testMelhorEnvio({
          token: secrets.token ?? "",
          email: row.options?.email ?? "",
          baseUrl: MELHOR_ENVIO_HOSTS[row.environment],
          environment: row.environment,
        });

  const db = getDb();
  await db.batch([
    db
      .update(integrations)
      .set({
        test_ok: result.ok,
        tested_at: new Date().toISOString(),
        test_message: result.message,
        // A failing test turns it off: what is on has to work.
        ...(result.ok ? {} : { active: false }),
      })
      .where(eq(integrations.provider, provider)),
    db.insert(integration_log).values({
      provider,
      action: `Teste de conexão ${result.ok ? "ok" : "falhou"}: ${result.message}`,
      actor_email: user.email,
    }),
  ]);
  revalidate();
  return result;
}

/** "Ativo". On only after a passing test; Melhor Envio also needs the
 * origin CEP and every active product with weight and measures. */
export async function setIntegrationActiveAction(
  provider: IntegrationProvider,
  active: boolean,
): Promise<IntegrationActionResult> {
  const user = await requireAdmin();
  const row = await getRow(provider);
  if (!row?.secrets) return { ok: false, message: "Salve e teste as credenciais primeiro." };

  if (active) {
    if (!row.test_ok) return { ok: false, message: "Teste a conexão e confira que passou antes de ativar." };
    if (provider === "melhorenvio") {
      const settings = await getSiteSettings();
      if (!isValidCep(settings.origin_cep ?? "")) {
        return { ok: false, message: "Cadastre o CEP de origem em Configurações antes de ativar." };
      }
      const missing = await getActiveProductsMissingPackage();
      if (missing.length > 0) {
        return {
          ok: false,
          message: `${missing.length} ${missing.length === 1 ? "produto ativo está" : "produtos ativos estão"} sem peso ou medidas. Complete antes de ativar.`,
        };
      }
    }
  }

  const db = getDb();
  await db.batch([
    db
      .update(integrations)
      .set({ active, updated_at: new Date().toISOString(), updated_by: user.email })
      .where(eq(integrations.provider, provider)),
    db.insert(integration_log).values({
      provider,
      action: active ? "Ativado" : "Desativado",
      actor_email: user.email,
    }),
  ]);
  revalidate();
  return {
    ok: true,
    message: `${PROVIDER_LABEL[provider]} ${active ? "ativado" : "desativado"}.`,
  };
}
