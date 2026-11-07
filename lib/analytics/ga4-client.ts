import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Google Analytics Data API (GA4), from the Worker.
 *
 * Authenticates as a Google Cloud service account that was given read
 * access (Leitor) to the KING STORE property: the Worker signs a JWT with
 * the account's private key (WebCrypto, RS256), trades it for an OAuth
 * access token and calls the API with it. The key and the token never
 * leave the server — the panel's browser only ever sees the numbers.
 *
 * Configuration (Cloudflare → Workers → site-king → Settings → Variables
 * and Secrets):
 *   GA4_PROPERTY_ID           numeric property id (Admin → Property
 *                             details), not the "G-..." measurement id
 *   GA4_SERVICE_ACCOUNT_JSON  the whole JSON key file (Secret)
 * or, instead of the JSON, GA4_CLIENT_EMAIL + GA4_PRIVATE_KEY (Secret).
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://analyticsdata.googleapis.com/v1beta";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

export type Ga4Config = { propertyId: string; clientEmail: string; privateKey: string };

export type Ga4Status =
  | { ok: true }
  | { ok: false; reason: "not_configured"; missing: string[]; problems: string[] }
  | { ok: false; reason: "error"; message: string };

export class Ga4Error extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "Ga4Error";
  }
}

/**
 * The Worker's variables, read straight from the Cloudflare bindings, with
 * `process.env` as the fallback (tests, `next dev`).
 *
 * Not `process.env` alone: OpenNext copies only *string* bindings into it.
 * A variable saved as type "JSON" in the dashboard (a number, or the key
 * file as an object) never reaches `process.env` — the panel then said the
 * variable was missing although it was set.
 */
function workerEnv(): Record<string, unknown> {
  let bindings: Record<string, unknown> = {};
  try {
    bindings = getCloudflareContext().env as unknown as Record<string, unknown>;
  } catch {
    // Outside the Worker (tests, build): only process.env.
  }
  const read = (name: string) => bindings[name] ?? process.env[name];
  return {
    GA4_PROPERTY_ID: read("GA4_PROPERTY_ID"),
    GA4_SERVICE_ACCOUNT_JSON: read("GA4_SERVICE_ACCOUNT_JSON"),
    GA4_CLIENT_EMAIL: read("GA4_CLIENT_EMAIL"),
    GA4_PRIVATE_KEY: read("GA4_PRIVATE_KEY"),
  };
}

/** Strips one pair of quotes a paste may have brought along. */
function unquote(value: string): string {
  const v = value.trim();
  const first = v[0];
  return v.length >= 2 && (first === '"' || first === "'") && v.at(-1) === first ? v.slice(1, -1).trim() : v;
}

type ServiceAccount = { client_email?: unknown; private_key?: unknown };

/** The key file as text (Secret/Text) or as an object (type JSON). A text
 * that holds a JSON *string* (pasted already escaped) is unwrapped once. */
function parseServiceAccount(value: unknown): ServiceAccount | null {
  if (value && typeof value === "object") return value as ServiceAccount;
  if (typeof value !== "string") return null;
  try {
    let parsed: unknown = JSON.parse(value.trim());
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    return parsed && typeof parsed === "object" ? (parsed as ServiceAccount) : null;
  } catch {
    return null;
  }
}

/**
 * The configuration, or what is wrong with it — by variable name and in
 * plain words, never with the value itself (the key is a secret, and even
 * a prefix of it must not reach the page).
 */
export function readGa4Config(env: Record<string, unknown> = workerEnv()):
  | { ok: true; config: Ga4Config }
  | { ok: false; missing: string[]; problems: string[] } {
  const missing: string[] = [];
  const problems: string[] = [];

  // GA4_PROPERTY_ID: text or number.
  const rawProperty = env.GA4_PROPERTY_ID;
  let propertyId = "";
  if (rawProperty === undefined || rawProperty === null || rawProperty === "") {
    missing.push("GA4_PROPERTY_ID");
    problems.push("GA4_PROPERTY_ID não chegou ao Worker publicado.");
  } else if (typeof rawProperty === "number" || typeof rawProperty === "string") {
    propertyId = unquote(String(rawProperty)).replace(/^properties\//, "");
    if (!/^\d+$/.test(propertyId)) {
      missing.push("GA4_PROPERTY_ID");
      problems.push(
        /^G-/i.test(propertyId)
          ? "GA4_PROPERTY_ID está com o ID de medição (G-...). Use o número da propriedade."
          : "GA4_PROPERTY_ID chegou, mas não é só número.",
      );
    }
  } else {
    missing.push("GA4_PROPERTY_ID");
    problems.push("GA4_PROPERTY_ID chegou num formato inesperado. Cadastre como Texto.");
  }

  // Credentials: the whole JSON, or e-mail + key separately.
  const rawJson = env.GA4_SERVICE_ACCOUNT_JSON;
  let clientEmail = typeof env.GA4_CLIENT_EMAIL === "string" ? env.GA4_CLIENT_EMAIL.trim() : "";
  let privateKey = typeof env.GA4_PRIVATE_KEY === "string" ? env.GA4_PRIVATE_KEY : "";
  const hasJson = rawJson !== undefined && rawJson !== null && rawJson !== "";
  if (hasJson) {
    const account = parseServiceAccount(rawJson);
    if (!account) {
      problems.push(
        "GA4_SERVICE_ACCOUNT_JSON chegou, mas não é um JSON válido. Cole o conteúdo do arquivo inteiro, de { até }.",
      );
    } else {
      if (typeof account.client_email === "string") clientEmail = account.client_email.trim() || clientEmail;
      if (typeof account.private_key === "string") privateKey = account.private_key || privateKey;
      if (!clientEmail) problems.push("GA4_SERVICE_ACCOUNT_JSON não tem o campo client_email.");
      if (!privateKey.includes("PRIVATE KEY")) {
        problems.push("GA4_SERVICE_ACCOUNT_JSON não tem a chave privada (private_key). Use a chave JSON da conta de serviço.");
      }
    }
  } else if (!clientEmail && !privateKey) {
    problems.push("GA4_SERVICE_ACCOUNT_JSON não chegou ao Worker publicado.");
  }
  if (!clientEmail || !privateKey.includes("PRIVATE KEY")) missing.push("GA4_SERVICE_ACCOUNT_JSON");

  if (missing.length > 0) return { ok: false, missing, problems };
  return { ok: true, config: { propertyId, clientEmail, privateKey } };
}

// --- JWT / token -----------------------------------------------------------

function base64url(input: ArrayBuffer | Uint8Array | string): string {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** PEM (PKCS#8, as Google's key files have it) → DER bytes. Accepts the
 * key with real line breaks or with literal "\n", as pasted secrets do. */
export function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const der = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) der[i] = binary.charCodeAt(i);
  return der;
}

export async function signServiceAccountJwt(config: Ga4Config, nowSeconds: number): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: config.clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(config.privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64url(signature)}`;
}

/** Per Worker isolate: a token lasts an hour, reused until 5 min before. */
let cachedToken: { key: string; token: string; expiresAt: number } | null = null;

async function accessToken(config: Ga4Config): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.key === config.clientEmail && cachedToken.expiresAt > now + 300_000) {
    return cachedToken.token;
  }
  let assertion: string;
  try {
    assertion = await signServiceAccountJwt(config, Math.floor(now / 1000));
  } catch {
    throw new Ga4Error(
      "A chave privada da conta de serviço não pôde ser lida. Cole o arquivo JSON inteiro no segredo GA4_SERVICE_ACCOUNT_JSON.",
      0,
    );
  }
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!response.ok || !data.access_token) {
    throw new Ga4Error(
      `O Google recusou a conta de serviço (${data.error_description ?? response.status}). Confira se a chave não foi excluída.`,
      response.status,
    );
  }
  cachedToken = {
    key: config.clientEmail,
    token: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

// --- API calls --------------------------------------------------------------

function explain(status: number, message: string): string {
  if (status === 403) {
    return /has not been used|disabled/i.test(message)
      ? "A Google Analytics Data API não está ativada no projeto do Google Cloud."
      : "A conta de serviço não tem acesso à propriedade do GA4. Adicione o e-mail dela como Leitor em Administrador → Gerenciamento de acesso da propriedade.";
  }
  if (status === 404) return "Propriedade do GA4 não encontrada. Confira o GA4_PROPERTY_ID (é o número, não o G-...).";
  if (status === 429) return "Limite de consultas do Google Analytics atingido por agora. Tente de novo em alguns minutos.";
  return message || `Erro ${status} do Google Analytics.`;
}

async function call<T>(config: Ga4Config, method: string, body: unknown): Promise<T> {
  const token = await accessToken(config);
  const response = await fetch(`${API}/properties/${config.propertyId}:${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Ga4Error(explain(response.status, data.error?.message ?? ""), response.status);
  }
  return data;
}

// --- Request / response shapes (the parts this panel uses) ------------------

export type DateRange = { startDate: string; endDate: string; name?: string };
export type MinuteRange = { startMinutesAgo?: number; endMinutesAgo?: number; name?: string };

export type FilterExpression =
  | { filter: { fieldName: string; stringFilter?: { value: string; matchType?: string }; inListFilter?: { values: string[] } } }
  | { andGroup: { expressions: FilterExpression[] } }
  | { notExpression: FilterExpression };

export type ReportRequest = {
  dimensions?: { name: string }[];
  metrics: { name: string }[];
  dateRanges?: DateRange[];
  minuteRanges?: MinuteRange[];
  dimensionFilter?: FilterExpression;
  orderBys?: ({ metric: { metricName: string }; desc?: boolean } | { dimension: { dimensionName: string }; desc?: boolean })[];
  limit?: number;
  metricAggregations?: ("TOTAL" | "MAXIMUM" | "MINIMUM")[];
  keepEmptyRows?: boolean;
};

type RawRow = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };
export type RawReport = {
  dimensionHeaders?: { name: string }[];
  metricHeaders?: { name: string; type?: string }[];
  rows?: RawRow[];
  totals?: RawRow[];
  rowCount?: number;
};

export type ReportRow = { dims: Record<string, string>; metrics: Record<string, number> };

/** Rows as plain objects keyed by the header names. */
export function readRows(report: RawReport, which: "rows" | "totals" = "rows"): ReportRow[] {
  const dimNames = (report.dimensionHeaders ?? []).map((h) => h.name);
  const metricNames = (report.metricHeaders ?? []).map((h) => h.name);
  return (report[which] ?? []).map((row) => ({
    dims: Object.fromEntries(dimNames.map((name, i) => [name, row.dimensionValues?.[i]?.value ?? ""])),
    metrics: Object.fromEntries(
      metricNames.map((name, i) => [name, Number(row.metricValues?.[i]?.value ?? 0) || 0]),
    ),
  }));
}

export function runReport(config: Ga4Config, request: ReportRequest) {
  return call<RawReport>(config, "runReport", request);
}

/** Up to 5 reports in one call (the API's limit). */
export async function batchRunReports(config: Ga4Config, requests: ReportRequest[]): Promise<RawReport[]> {
  const data = await call<{ reports?: RawReport[] }>(config, "batchRunReports", { requests });
  return data.reports ?? [];
}

export function runRealtimeReport(config: Ga4Config, request: ReportRequest) {
  return call<RawReport>(config, "runRealtimeReport", request);
}

// --- Small TTL cache ---------------------------------------------------------

const memo = new Map<string, { at: number; value: Promise<unknown> }>();

/**
 * Same question within `ttlMs` → the same answer, per Worker isolate. Keeps
 * two admins (or two tabs) polling the panel from doubling the API quota.
 * A failed call is not kept.
 */
export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = memo.get(key);
  if (hit && now - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = load();
  memo.set(key, { at: now, value });
  value.catch(() => {
    if (memo.get(key)?.value === value) memo.delete(key);
  });
  if (memo.size > 200) {
    for (const [k, entry] of memo) if (now - entry.at > 10 * 60_000) memo.delete(k);
  }
  return value;
}
