import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import { createTestDb } from "./support/d1";

/**
 * Admin → Integrações (Etapa 2): tokens encrypted and masked, "Ativo" only
 * after a passing test, Melhor Envio guarded by the catalogue, the sales
 * mode following the switches, the environment variables as fallback.
 */

const state = vi.hoisted(() => ({ db: null as unknown as Db }));

vi.mock("@/lib/db", async () => ({
  getDb: () => state.db,
  schema: await import("@/lib/db/schema"),
}));
vi.mock("@/lib/auth/guards", () => ({
  getCurrentUser: async () => null,
  requireAdmin: async () => ({ id: "admin-1", email: "dono@kingstore.test", role: "admin" }),
  requireAdminPage: async () => ({ id: "admin-1", email: "dono@kingstore.test", role: "admin" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const actions = await import("@/lib/actions/integrations");
const { getIntegrationsAdmin } = await import("@/lib/data/integrations");
const { getMercadoPagoCredentials, getMelhorEnvioCredentials, integrationState } = await import(
  "@/lib/integrations"
);
const { getSalesMode } = await import("@/lib/sales-mode");

const { integrations, integration_log, products, site_settings } = schema;

const MP_TOKEN = "APP_USR-7777777777777777-090909-abcdefabcdefabcdef-123456789-3f9a";
const ME_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.sandbox-token-value-9z8y";

let dispose: () => Promise<void>;

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function mockFetch(status: number, body: unknown) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
      return new Response(JSON.stringify(body), { status });
    }),
  );
  return calls;
}

async function row(provider: "mercadopago" | "melhorenvio") {
  const [found] = await state.db.select().from(integrations).where(eq(integrations.provider, provider));
  return found;
}

beforeAll(async () => {
  ({ db: state.db, dispose } = await createTestDb());
  process.env.INTEGRATIONS_KEY = Buffer.alloc(32, 3).toString("base64");
  await state.db.insert(site_settings).values({ id: 1, store_name: "King Store", origin_cep: "01310100" });
});

afterAll(async () => {
  delete process.env.INTEGRATIONS_KEY;
  vi.unstubAllGlobals();
  await dispose?.();
});

beforeEach(async () => {
  await state.db.delete(integrations);
  await state.db.delete(integration_log);
  await state.db.delete(products);
  vi.unstubAllGlobals();
  delete process.env.MERCADOPAGO_ACCESS_TOKEN;
  Reflect.deleteProperty(process.env, "PAYMENT_PROVIDER");
});

async function saveMercadoPago(token = MP_TOKEN, environment = "production") {
  return actions.saveMercadoPagoAction({ status: "idle" }, form({ environment, access_token: token, webhook_secret: "" }));
}

describe("Mercado Pago no painel", () => {
  it("guarda o token criptografado, mostra só o final e registra quem mudou", async () => {
    expect((await saveMercadoPago()).status).toBe("success");
    const saved = await row("mercadopago");
    expect(saved.secrets).not.toContain(MP_TOKEN);
    expect(saved.secrets).not.toContain("3f9a");
    expect(saved.hints).toEqual({ access_token: "3f9a" });
    expect(saved.active).toBe(false);
    expect(saved.updated_by).toBe("dono@kingstore.test");

    const [entry] = await state.db.select().from(integration_log);
    expect(entry.actor_email).toBe("dono@kingstore.test");
    expect(entry.action).not.toContain(MP_TOKEN);

    // What the panel page receives never holds the token.
    const page = JSON.stringify(await getIntegrationsAdmin());
    expect(page).not.toContain(MP_TOKEN);
    expect(page).not.toContain(saved.secrets!);
  });

  it("só ativa depois de um teste que passou; trocar o token desliga de novo", async () => {
    await saveMercadoPago();
    expect((await actions.setIntegrationActiveAction("mercadopago", true)).ok).toBe(false);

    const calls = mockFetch(200, { id: 1, nickname: "KINGSTORE", tags: ["normal"] });
    const tested = await actions.testIntegrationAction("mercadopago");
    expect(tested).toMatchObject({ ok: true });
    expect(tested.message).toContain("KINGSTORE");
    expect(calls[0].url).toBe("https://api.mercadopago.com/users/me");
    expect(calls[0].headers.Authorization).toBe(`Bearer ${MP_TOKEN}`);

    expect((await actions.setIntegrationActiveAction("mercadopago", true)).ok).toBe(true);
    expect((await integrationState("mercadopago")).active).toBe(true);

    await saveMercadoPago(MP_TOKEN.replace("3f9a", "4e8b"));
    const replaced = await row("mercadopago");
    expect(replaced.active).toBe(false);
    expect(replaced.test_ok).toBe(false);
    expect(replaced.hints).toEqual({ access_token: "4e8b" });
  });

  it("salvar sem mudar nada não desliga", async () => {
    await saveMercadoPago();
    mockFetch(200, { nickname: "KINGSTORE" });
    await actions.testIntegrationAction("mercadopago");
    await actions.setIntegrationActiveAction("mercadopago", true);
    const again = await actions.saveMercadoPagoAction(
      { status: "idle" },
      form({ environment: "production", access_token: "", webhook_secret: "" }),
    );
    expect(again).toMatchObject({ status: "success", message: "Nada mudou." });
    expect((await row("mercadopago")).active).toBe(true);
  });

  it("avisa quando o token de teste está no ambiente de produção", async () => {
    await saveMercadoPago("TEST-1234567890123456-090909-abcdef", "production");
    mockFetch(200, { nickname: "TESTUSER" });
    const tested = await actions.testIntegrationAction("mercadopago");
    expect(tested.ok).toBe(false);
    expect(tested.message).toContain("O token é de teste");
  });

  it("token recusado: o teste falha sem mostrar o token", async () => {
    await saveMercadoPago();
    mockFetch(401, { message: "invalid token" });
    const tested = await actions.testIntegrationAction("mercadopago");
    expect(tested.ok).toBe(false);
    expect(tested.message).not.toContain(MP_TOKEN);
  });
});

describe("Melhor Envio no painel", () => {
  async function saveAndTest() {
    await actions.saveMelhorEnvioAction(
      { status: "idle" },
      form({ environment: "test", token: ME_TOKEN, email: "contato@kingstore.test" }),
    );
    const calls = mockFetch(200, { firstname: "King", lastname: "Store", email: "contato@kingstore.test" });
    expect((await actions.testIntegrationAction("melhorenvio")).ok).toBe(true);
    return calls;
  }

  it("testa no host do ambiente escolhido, com o e-mail no User-Agent", async () => {
    const calls = await saveAndTest();
    expect(calls[0].url).toBe("https://sandbox.melhorenvio.com.br/api/v2/me");
    expect(calls[0].headers["User-Agent"]).toBe("King Store (contato@kingstore.test)");
  });

  it("não ativa com produto ativo sem peso ou medidas; completo, ativa", async () => {
    await state.db.insert(products).values({ id: "p-sem-peso", name: "Boné", slug: "bone", price: 50, status: "active" });
    await saveAndTest();
    const refused = await actions.setIntegrationActiveAction("melhorenvio", true);
    expect(refused.ok).toBe(false);
    expect(refused.message).toContain("1 produto ativo está sem peso ou medidas");

    await state.db
      .update(products)
      .set({ weight_grams: 200, length_cm: 20, width_cm: 15, height_cm: 5 })
      .where(eq(products.id, "p-sem-peso"));
    expect((await actions.setIntegrationActiveAction("melhorenvio", true)).ok).toBe(true);
    expect(await getMelhorEnvioCredentials({ requireActive: true })).toMatchObject({
      token: ME_TOKEN,
      baseUrl: "https://sandbox.melhorenvio.com.br",
      environment: "test",
    });
  });
});

describe("modo de venda", () => {
  it("segue as chaves do painel, sem deploy (o checkout só abre com a Etapa 3)", async () => {
    await saveMercadoPago();
    mockFetch(200, { nickname: "KINGSTORE" });
    await actions.testIntegrationAction("mercadopago");
    await actions.setIntegrationActiveAction("mercadopago", true);
    const settings = { origin_cep: "01310100" };
    expect(await getSalesMode(settings)).toMatchObject({ mercadoPagoActive: true, checkoutOpen: false });

    await actions.setIntegrationActiveAction("mercadopago", false);
    expect(await getSalesMode(settings)).toMatchObject({ mercadoPagoActive: false, checkoutOpen: false });
    expect(await getMercadoPagoCredentials({ requireActive: true })).toBeNull();
    // The webhook still reaches the account after it was switched off.
    expect(await getMercadoPagoCredentials({ requireActive: false })).toMatchObject({ accessToken: MP_TOKEN });
  });

  it("sem nada salvo no painel, as variáveis de ambiente valem; salvas no painel, o painel decide", async () => {
    process.env.MERCADOPAGO_ACCESS_TOKEN = "APP_USR-env-token-0000000000000000";
    expect(await integrationState("mercadopago")).toMatchObject({ source: "env", active: true });

    await saveMercadoPago();
    expect(await integrationState("mercadopago")).toMatchObject({ source: "panel", active: false });
  });

  it("PAYMENT_PROVIDER=whatsapp ainda desliga a reserva", async () => {
    process.env.MERCADOPAGO_ACCESS_TOKEN = "APP_USR-env-token-0000000000000000";
    process.env.PAYMENT_PROVIDER = "whatsapp";
    expect(await integrationState("mercadopago")).toMatchObject({ source: "none", active: false });
  });
});
