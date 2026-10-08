import "server-only";
import { cache } from "react";
import { getDb, schema } from "@/lib/db";
import { safeQuery } from "@/lib/data/safe";
import type { IntegrationEnvironment, IntegrationProvider } from "@/lib/db/schema";
import type { Tables } from "@/lib/database.types";
import { decryptSecrets } from "./crypto";

export type IntegrationRow = Tables<"integrations">;

/**
 * Where Mercado Pago and Melhor Envio get their credentials.
 *
 * The panel first (Admin → Integrações, table `integrations`): once
 * credentials are saved there, that row decides — its "Ativo" switch
 * included, so turning a service off in the panel turns it off even if
 * the old environment variables are still set. Without saved credentials
 * the environment variables are the fallback, as before the panel
 * existed.
 */

/** Both rows, read once per request (the layout and the pages all ask). */
export const getIntegrationRows = cache(
  async (): Promise<Map<IntegrationProvider, IntegrationRow>> =>
    safeQuery(async () => {
      const rows = await getDb().select().from(schema.integrations);
      return new Map(rows.map((row) => [row.provider, row]));
    }, new Map()),
);

export type IntegrationSource = "panel" | "env" | "none";

export type IntegrationState = {
  source: IntegrationSource;
  /** Usable for selling right now. */
  active: boolean;
  environment: IntegrationEnvironment | null;
};

function envMercadoPago() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  // PAYMENT_PROVIDER=whatsapp was how a store switched online payment off.
  if (!accessToken || process.env.PAYMENT_PROVIDER === "whatsapp") return null;
  return {
    accessToken,
    webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim() || null,
    environment: (accessToken.startsWith("TEST-") ? "test" : "production") as IntegrationEnvironment,
  };
}

/** Melhor Envio's two hosts — same paths, different accounts and tokens. */
export const MELHOR_ENVIO_HOSTS: Record<IntegrationEnvironment, string> = {
  test: "https://sandbox.melhorenvio.com.br",
  production: "https://melhorenvio.com.br",
};

function envMelhorEnvio() {
  const token = process.env.MELHORENVIO_TOKEN?.trim();
  const url = process.env.MELHORENVIO_URL?.trim();
  const email = process.env.MELHORENVIO_EMAIL?.trim();
  if (!token || !url || !email) return null;
  return {
    token,
    email,
    baseUrl: url.replace(/\/+$/, ""),
    environment: (url.includes("sandbox") ? "test" : "production") as IntegrationEnvironment,
  };
}

export async function integrationState(provider: IntegrationProvider): Promise<IntegrationState> {
  const row = (await getIntegrationRows()).get(provider);
  if (row?.secrets) {
    return { source: "panel", active: row.active, environment: row.environment };
  }
  const env = provider === "mercadopago" ? envMercadoPago() : envMelhorEnvio();
  return env
    ? { source: "env", active: true, environment: env.environment }
    : { source: "none", active: false, environment: null };
}

/** What a saved row holds, decrypted. Only for the server, never sent on. */
async function panelSecrets(provider: IntegrationProvider): Promise<{
  row: IntegrationRow;
  secrets: Record<string, string>;
} | null> {
  const row = (await getIntegrationRows()).get(provider);
  if (!row?.secrets) return null;
  return { row, secrets: await decryptSecrets(provider, row.secrets) };
}

export type MercadoPagoCredentials = {
  accessToken: string;
  webhookSecret: string | null;
  environment: IntegrationEnvironment;
};

/**
 * `requireActive`: for selling (creating a payment). The webhook passes
 * false — a payment made while the service was on still has to be
 * reconciled after it is switched off.
 */
export async function getMercadoPagoCredentials({
  requireActive,
}: {
  requireActive: boolean;
}): Promise<MercadoPagoCredentials | null> {
  const saved = await panelSecrets("mercadopago");
  if (saved) {
    if (requireActive && !saved.row.active) return null;
    if (!saved.secrets.access_token) return null;
    return {
      accessToken: saved.secrets.access_token,
      webhookSecret: saved.secrets.webhook_secret || null,
      environment: saved.row.environment,
    };
  }
  return envMercadoPago();
}

export type MelhorEnvioCredentials = {
  token: string;
  /** Goes in the User-Agent; Melhor Envio requires it. */
  email: string;
  baseUrl: string;
  environment: IntegrationEnvironment;
};

export async function getMelhorEnvioCredentials({
  requireActive,
}: {
  requireActive: boolean;
}): Promise<MelhorEnvioCredentials | null> {
  const saved = await panelSecrets("melhorenvio");
  if (saved) {
    if (requireActive && !saved.row.active) return null;
    const email = saved.row.options?.email;
    if (!saved.secrets.token || !email) return null;
    return {
      token: saved.secrets.token,
      email,
      baseUrl: MELHOR_ENVIO_HOSTS[saved.row.environment],
      environment: saved.row.environment,
    };
  }
  return envMelhorEnvio();
}
