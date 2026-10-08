import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import { createTestDb } from "./support/d1";

/**
 * Guest coupons (Etapa 1): checked on the server for visitors, used only
 * when the sale is confirmed, given back on cancel, flagged per phone,
 * guarded against guessing.
 */

const state = vi.hoisted(() => ({ db: null as unknown as Db }));

vi.mock("@/lib/db", async () => ({
  getDb: () => state.db,
  schema: await import("@/lib/db/schema"),
}));
vi.mock("@/lib/auth/guards", () => ({
  // A visitor in the shop; the panel's actions only need requireAdmin to pass.
  getCurrentUser: async () => null,
  requireAdmin: async () => ({ id: "admin", role: "admin" }),
  requireAdminPage: async () => ({ id: "admin", role: "admin" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const whatsapp = await import("@/lib/orders/whatsapp");
const { createWhatsAppOrderAction, confirmWhatsAppOrderAction } = await import(
  "@/lib/actions/whatsapp-orders"
);
const { updateOrderStatusAction } = await import("@/lib/actions/orders");
const { POST: validateRoute } = await import("@/app/api/coupons/validate/route");

const { products, product_variants, site_settings, coupons, orders } = schema;

const PRODUCT = "aaaaaaaa-1111-4000-a000-000000000001";
const VARIANT = "bbbbbbbb-1111-4000-a000-000000000001";
const PRICE = 100;

let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ db: state.db, dispose } = await createTestDb());
  await state.db.insert(products).values({ id: PRODUCT, name: "Moletom", slug: "moletom-cupom", price: PRICE, status: "active" });
  await state.db.insert(product_variants).values({ id: VARIANT, product_id: PRODUCT, color: "Preto", size: "M", stock: 100 });
  await state.db.insert(site_settings).values({ id: 1, store_name: "King Store", whatsapp: "5511999999999", free_shipping_threshold: 399 });
});

afterAll(async () => {
  await dispose?.();
});

beforeEach(async () => {
  await state.db.delete(orders);
  await state.db.delete(coupons);
  await state.db.delete(schema.rate_limits);
  await state.db.update(product_variants).set({ stock: 100 }).where(eq(product_variants.id, VARIANT));
});

async function coupon(values: Partial<typeof coupons.$inferInsert> & { code: string }) {
  await state.db.insert(coupons).values({ type: "percent", value: 10, ...values });
}

async function usedCount(code: string) {
  const [row] = await state.db.select({ n: coupons.used_count }).from(coupons).where(eq(coupons.code, code));
  return row.n;
}

async function order(id: string) {
  const row = await state.db.query.orders.findFirst({ where: eq(orders.id, id) });
  return row!;
}

async function stock() {
  const [row] = await state.db.select({ stock: product_variants.stock }).from(product_variants).where(eq(product_variants.id, VARIANT));
  return row.stock;
}

async function bagOrder(couponCode: string | null, qty = 1) {
  const result = await createWhatsAppOrderAction({
    items: [{ variantId: VARIANT, qty }],
    couponCode,
    customerName: "Visitante Teste",
  });
  if (!result.ok) throw new Error(result.message);
  return result;
}

function validate(body: unknown, ip = "203.0.113.7") {
  return validateRoute(
    new Request("http://loja.test/api/coupons/validate", {
      method: "POST",
      headers: { "cf-connecting-ip": ip },
      body: JSON.stringify(body),
    }) as never,
  );
}

describe("o uso do cupom conta só na confirmação", () => {
  it("criar o pedido não gasta; confirmar conta uma vez", async () => {
    await coupon({ code: "DEZ", max_uses: 5 });
    const created = await bagOrder("DEZ");
    expect(await usedCount("DEZ")).toBe(0);
    expect((await order(created.orderId)).coupon_used_at).toBeNull();

    await whatsapp.confirmWhatsAppOrder(created.orderId, "11988887777");
    expect(await usedCount("DEZ")).toBe(1);
    const confirmed = await order(created.orderId);
    expect(confirmed.coupon_used_at).not.toBeNull();
    expect(confirmed.customer_phone).toBe("11988887777");
    expect(confirmed.customer_snapshot?.name).toBe("Visitante Teste");
  });

  it("pedido expirado não gasta o limite", async () => {
    await coupon({ code: "DEZ", max_uses: 1 });
    const created = await bagOrder("DEZ");
    await state.db.update(orders).set({ expires_at: "2000-01-01T00:00:00.000Z" }).where(eq(orders.id, created.orderId));
    await whatsapp.expireWhatsAppOrders();
    expect((await order(created.orderId)).status).toBe("expirado");
    expect(await usedCount("DEZ")).toBe(0);
  });

  it("limite atingido por outra venda: a confirmação não muda nada; sem o desconto, confirma", async () => {
    await coupon({ code: "UM", max_uses: 1 });
    const first = await bagOrder("UM");
    const second = await bagOrder("UM");
    await whatsapp.confirmWhatsAppOrder(first.orderId);
    const stockBefore = await stock();

    await expect(whatsapp.confirmWhatsAppOrder(second.orderId)).rejects.toMatchObject({ code: "COUPON_LIMIT" });
    expect(await stock()).toBe(stockBefore);
    expect((await order(second.orderId)).status).toBe("aguardando_whatsapp");

    const result = await confirmWhatsAppOrderAction({ order_id: second.orderId, remove_discount: true });
    expect(result.ok).toBe(true);
    const confirmed = await order(second.orderId);
    expect(confirmed.status).toBe("paid");
    expect(confirmed.coupon_code).toBeNull();
    expect(confirmed.discount).toBe(0);
    expect(confirmed.total).toBe(PRICE);
    expect(await usedCount("UM")).toBe(1);
  });

  it("cancelar uma venda confirmada devolve o uso; reabrir conta de novo", async () => {
    await coupon({ code: "DEZ", max_uses: 5 });
    const created = await bagOrder("DEZ");
    await whatsapp.confirmWhatsAppOrder(created.orderId);
    expect(await usedCount("DEZ")).toBe(1);

    expect((await updateOrderStatusAction({ order_id: created.orderId, status: "canceled" })).ok).toBe(true);
    expect(await usedCount("DEZ")).toBe(0);
    expect((await order(created.orderId)).coupon_used_at).toBeNull();
    // Twice changes nothing.
    await updateOrderStatusAction({ order_id: created.orderId, status: "canceled" });
    expect(await usedCount("DEZ")).toBe(0);

    await updateOrderStatusAction({ order_id: created.orderId, status: "paid" });
    expect(await usedCount("DEZ")).toBe(1);
  });
});

describe("um uso por telefone", () => {
  it("aponta a venda anterior do mesmo telefone, sem bloquear", async () => {
    await coupon({ code: "BEMVINDO", one_per_phone: true });
    const first = await bagOrder("BEMVINDO");
    await whatsapp.confirmWhatsAppOrder(first.orderId, "11988887777");
    const second = await bagOrder("BEMVINDO");

    const same = await whatsapp.findCouponPhoneUses(second.orderId, "11988887777");
    expect(same.previous.map((p) => p.label)).toEqual([`#${first.code}`]);
    expect((await whatsapp.findCouponPhoneUses(second.orderId, "11977776666")).previous).toEqual([]);

    // Not blocked: it confirms all the same.
    await whatsapp.confirmWhatsAppOrder(second.orderId, "11988887777");
    expect(await usedCount("BEMVINDO")).toBe(2);
  });

  it("não avisa quando o cupom não é de um uso por telefone", async () => {
    await coupon({ code: "LIVRE" });
    const first = await bagOrder("LIVRE");
    await whatsapp.confirmWhatsAppOrder(first.orderId, "11988887777");
    const second = await bagOrder("LIVRE");
    expect((await whatsapp.findCouponPhoneUses(second.orderId, "11988887777")).previous).toEqual([]);
  });
});

describe("o servidor recalcula tudo", () => {
  it("cupom vencido vindo do navegador: recusa e informa o total sem ele", async () => {
    await coupon({ code: "VELHO", expires_at: "2020-01-01" });
    const result = await createWhatsAppOrderAction({
      items: [{ variantId: VARIANT, qty: 2 }],
      couponCode: "VELHO",
      customerName: "Ana",
    });
    expect(result).toMatchObject({ ok: false, couponRejected: true, totalWithoutCoupon: 2 * PRICE });
    expect(await state.db.select().from(orders)).toEqual([]);
  });

  it("frete grátis pelo cupom e desconto calculado no servidor", async () => {
    await coupon({ code: "FRETE", type: "fixed", value: 0, free_shipping: true });
    const created = await bagOrder("FRETE");
    const row = await order(created.orderId);
    expect(row.shipping_mode).toBe("free");
    expect(row.discount).toBe(0);
    expect(row.total).toBe(PRICE);
  });

  it("pede o nome antes de abrir o WhatsApp", async () => {
    const result = await createWhatsAppOrderAction({ items: [{ variantId: VARIANT, qty: 1 }], customerName: " " });
    expect(result).toMatchObject({ ok: false, message: "Digite seu nome." });
  });
});

describe("POST /api/coupons/validate", () => {
  it("sem sacola, confere só o cupom (página do produto, link)", async () => {
    await coupon({ code: "MIN200", min_total: 200 });
    const body = await (await validate({ code: "min200", items: [] })).json();
    expect(body).toMatchObject({ ok: true, code: "MIN200", discount: 0, offer: { minTotal: 200, type: "percent", value: 10 } });
  });

  it("abaixo do mínimo: diz quanto falta e mantém o cupom", async () => {
    await coupon({ code: "MIN200", min_total: 200 });
    const body = await (await validate({ code: "MIN200", items: [{ variantId: VARIANT, qty: 1 }] })).json();
    expect(body).toMatchObject({ ok: false, reason: "BELOW_MINIMUM", missing: 100, offer: { code: "MIN200" } });
  });

  it("10 tentativas erradas por minuto bloqueiam o IP; acertos não contam", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T12:00:05Z"));
    try {
      await coupon({ code: "CERTO" });
      for (let i = 0; i < 15; i++) {
        expect((await validate({ code: "CERTO", items: [] })).status).toBe(200);
      }
      for (let i = 0; i < 10; i++) {
        const body = (await (await validate({ code: `ERRADO${i}`, items: [] })).json()) as { reason: string };
        expect(body.reason).toBe("NOT_FOUND");
      }
      const blocked = await validate({ code: "CERTO", items: [] });
      expect(blocked.status).toBe(429);
      expect(((await blocked.json()) as { reason: string }).reason).toBe("RATE_LIMITED");
      // Another client is not affected.
      expect((await validate({ code: "CERTO", items: [] }, "198.51.100.9")).status).toBe(200);

      vi.setSystemTime(new Date("2026-10-08T12:01:01Z"));
      expect((await validate({ code: "CERTO", items: [] })).status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("migration 0008 em pedidos que já existiam", () => {
  it("marca os confirmados e reconta os usos só com eles", async () => {
    await coupon({ code: "ANTIGO", used_count: 3, max_uses: 10 });
    await state.db.insert(orders).values([
      { id: "eeeeeeee-0000-4000-a000-000000000001", order_number: 801, status: "paid", coupon_code: "ANTIGO" },
      { id: "eeeeeeee-0000-4000-a000-000000000002", order_number: 802, status: "delivered", coupon_code: "ANTIGO" },
      { id: "eeeeeeee-0000-4000-a000-000000000003", order_number: 803, status: "aguardando_whatsapp", code: "KS0803", coupon_code: "ANTIGO" },
    ]);

    const sql = readFileSync(path.resolve(__dirname, "../drizzle/migrations/0008_guest_coupons.sql"), "utf8");
    const updates = sql.split("--> statement-breakpoint").filter((chunk) => /^\s*UPDATE/m.test(chunk.replace(/^--.*$/gm, "")));
    expect(updates).toHaveLength(2);
    const d1 = (state.db as unknown as { $client: D1Database }).$client;
    for (const statement of updates) await d1.prepare(statement.replace(/^--.*$/gm, "").trim()).run();

    expect(await usedCount("ANTIGO")).toBe(2);
    expect((await order("eeeeeeee-0000-4000-a000-000000000001")).coupon_used_at).not.toBeNull();
    expect((await order("eeeeeeee-0000-4000-a000-000000000003")).coupon_used_at).toBeNull();
  });
});
