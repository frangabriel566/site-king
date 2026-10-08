import "server-only";
import type { IntegrationEnvironment } from "@/lib/db/schema";
import type { MelhorEnvioCredentials, MercadoPagoCredentials } from "./index";

export type ConnectionTest = {
  ok: boolean;
  /** For the panel, in Portuguese: the account and the environment, or
   * what went wrong. Never a token. */
  message: string;
};

const TIMEOUT_MS = 10_000;

const ENVIRONMENT_LABEL: Record<IntegrationEnvironment, string> = {
  test: "teste",
  production: "produção",
};

async function getJson(
  url: string,
  headers: Record<string, string>,
): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", ...headers },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  let body: Record<string, unknown> | null = null;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // An HTML error page: the status says enough.
  }
  return { status: response.status, body };
}

function unreachable(service: string): ConnectionTest {
  return { ok: false, message: `Não foi possível falar com o ${service}. Tente de novo em instantes.` };
}

/**
 * A real, harmless call: who the token belongs to (`/users/me`). Says
 * whether the token is a test or a production one — Mercado Pago's test
 * credentials start with TEST-, and test users carry the "test_user" tag —
 * and whether that matches the environment chosen in the panel.
 */
export async function testMercadoPago(credentials: MercadoPagoCredentials): Promise<ConnectionTest> {
  let result;
  try {
    result = await getJson("https://api.mercadopago.com/users/me", {
      Authorization: `Bearer ${credentials.accessToken}`,
    });
  } catch {
    return unreachable("Mercado Pago");
  }
  if (result.status === 401 || result.status === 403) {
    return { ok: false, message: "O Mercado Pago recusou o Access Token. Confira se ele foi copiado inteiro." };
  }
  if (result.status !== 200 || !result.body) {
    return { ok: false, message: `O Mercado Pago respondeu ${result.status}.` };
  }

  const tags = Array.isArray(result.body.tags) ? (result.body.tags as unknown[]) : [];
  const detected: IntegrationEnvironment =
    credentials.accessToken.startsWith("TEST-") || tags.includes("test_user") ? "test" : "production";
  const account = String(result.body.nickname ?? result.body.email ?? result.body.id ?? "conta");
  if (detected !== credentials.environment) {
    return {
      ok: false,
      message: `O token é de ${ENVIRONMENT_LABEL[detected]}, mas o ambiente escolhido é ${ENVIRONMENT_LABEL[credentials.environment]}. Ajuste o seletor ou troque o token.`,
    };
  }
  return { ok: true, message: `Conectado à conta ${account} (${ENVIRONMENT_LABEL[detected]}).` };
}

/** `/api/v2/me` on the chosen host (sandbox or production): a token only
 * works on the host it was made on, so passing confirms both. */
export async function testMelhorEnvio(credentials: MelhorEnvioCredentials): Promise<ConnectionTest> {
  let result;
  try {
    result = await getJson(`${credentials.baseUrl}/api/v2/me`, {
      Authorization: `Bearer ${credentials.token}`,
      "User-Agent": `King Store (${credentials.email})`,
    });
  } catch {
    return unreachable("Melhor Envio");
  }
  if (result.status === 401 || result.status === 403) {
    return {
      ok: false,
      message: `O Melhor Envio (${credentials.environment === "test" ? "sandbox" : "produção"}) recusou o token. Confira o token e se ele é deste ambiente.`,
    };
  }
  if (result.status !== 200 || !result.body) {
    return { ok: false, message: `O Melhor Envio respondeu ${result.status}.` };
  }
  const name = [result.body.firstname, result.body.lastname].filter(Boolean).join(" ");
  const account = name || String(result.body.email ?? "conta");
  return {
    ok: true,
    message: `Conectado à conta ${account} (${credentials.environment === "test" ? "sandbox" : "produção"}).`,
  };
}
