import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import { createTestDb } from "./support/d1";

/**
 * The same bag, through every door it can take to an order, must cost the
 * same and read the same: what the bag shows (OrderTotals), the WhatsApp
 * order its "Finalizar compra" creates, and the checkout (closed today,
 * kept for when online payment returns) — order rows and messages alike.
 */

const state = vi.hoisted(() => ({
  db: null as unknown as Db,
  userId: null as string | null,
}));

vi.mock("@/lib/db", async () => ({
  getDb: () => state.db,
  schema: await import("@/lib/db/schema"),
}));
vi.mock("@/lib/auth/guards", () => ({
  getCurrentUser: async () =>
    state.userId ? { id: state.userId, email: "cliente@teste.com" } : null,
  requireAdmin: async () => undefined,
  requireAdminPage: async () => undefined,
}));
// The checkout's door is closed in production today; open it here to
// prove it would price the bag the same way.
vi.mock("@/lib/sales-mode", () => ({
  getSalesMode: () => ({ freightQuotes: true, checkoutOpen: true }),
}));

const { createWhatsAppOrderAction } = await import("@/lib/actions/whatsapp-orders");
const { createOrderAction } = await import("@/lib/actions/checkout");
const { POST: validateCoupon } = await import("@/app/api/coupons/validate/route");
const { orderSummaryLines, orderSummaryText, shippingModeFor, summaryFromOrder } = await import(
  "@/lib/orders/summary"
);

const { products, product_variants, site_settings, coupons, user, customers, orders } = schema;

const P1 = "aaaaaaaa-0000-4000-a000-000000000001";
const P2 = "aaaaaaaa-0000-4000-a000-000000000002";
const V1 = "bbbbbbbb-0000-4000-a000-000000000001";
const V2 = "bbbbbbbb-0000-4000-a000-000000000002";
const PRICE = { [V1]: 150, [V2]: 120 } as Record<string, number>;
const THRESHOLD = 399;
const CUSTOMER = "u-cliente";

let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ db: state.db, dispose } = await createTestDb());
  const db = state.db;
  await db.insert(products).values([
    { id: P1, name: "Moletom", slug: "moletom", price: 150, status: "active" },
    { id: P2, name: "Camiseta", slug: "camiseta", price: 120, status: "active" },
  ]);
  await db.insert(product_variants).values([
    { id: V1, product_id: P1, color: "Preto", size: "M", stock: 50 },
    { id: V2, product_id: P2, color: "Branco", size: "G", stock: 50 },
  ]);
  await db.insert(site_settings).values({
    id: 1,
    store_name: "King Store",
    whatsapp: "5511999999999",
    free_shipping_threshold: THRESHOLD,
  });
  await db.insert(coupons).values([
    { code: "DEZ", type: "percent", value: 10 },
    { code: "FRETE", type: "fixed", value: 0, free_shipping: true },
  ]);
  await db.insert(user).values({ id: CUSTOMER, name: "Ana", email: "cliente@teste.com" });
  await db.insert(customers).values({
    id: CUSTOMER,
    name: "Ana Souza",
    phone: "11988887777",
    birthdate: "1990-01-01",
  });
});

afterAll(async () => {
  await dispose?.();
});

type Line = { variantId: string; qty: number };

/** What the bag and the drawer show: their own subtotal, the coupon as
 * /api/coupons/validate answers it, and the store's free-shipping rule. */
async function bagLines(items: Line[], couponCode: string | null) {
  const subtotal = items.reduce((sum, item) => sum + PRICE[item.variantId] * item.qty, 0);
  let applied: { code: string; discount: number; freeShipping: boolean } | null = null;
  if (couponCode) {
    const response = await validateCoupon(
      new Request("http://loja.test/api/coupons/validate", {
        method: "POST",
        body: JSON.stringify({ code: couponCode, items }),
      }) as never,
    );
    const body = (await response.json()) as { ok: boolean; code: string; discount: number; freeShipping: boolean };
    expect(body.ok).toBe(true);
    applied = body;
  }
  return orderSummaryLines({
    subtotal,
    itemCount: items.reduce((sum, item) => sum + item.qty, 0),
    discount: applied?.discount ?? 0,
    couponCode: applied?.code ?? null,
    shippingMode: shippingModeFor(subtotal, THRESHOLD, Boolean(applied?.freeShipping)),
  });
}

function messageOf(url: string): string {
  return decodeURIComponent(new URL(url).searchParams.get("text") ?? "");
}

async function recorded(orderId: string) {
  const row = await state.db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { order_items: true },
  });
  expect(row).toBeTruthy();
  return row!;
}

const ADDRESS = {
  cep: "01310-100",
  street: "Avenida Paulista",
  number: "1000",
  complement: "",
  district: "Bela Vista",
  city: "São Paulo",
  state: "SP",
};

describe.each([
  { name: "abaixo do frete grátis, sem cupom", items: [{ variantId: V1, qty: 1 }, { variantId: V2, qty: 1 }], coupon: null, mode: "to_agree", total: 270 },
  { name: "acima de R$ 399, sem cupom", items: [{ variantId: V1, qty: 2 }, { variantId: V2, qty: 1 }], coupon: null, mode: "free", total: 420 },
  { name: "cupom de 10%", items: [{ variantId: V1, qty: 1 }, { variantId: V2, qty: 1 }], coupon: "DEZ", mode: "to_agree", total: 243 },
  { name: "acima de R$ 399 com cupom que leva abaixo", items: [{ variantId: V1, qty: 2 }, { variantId: V2, qty: 1 }], coupon: "DEZ", mode: "free", total: 378 },
  { name: "cupom de frete grátis", items: [{ variantId: V1, qty: 1 }, { variantId: V2, qty: 1 }], coupon: "FRETE", mode: "free", total: 270 },
] as const)("o mesmo carrinho ($name)", ({ items, coupon, mode, total }) => {
  it("dá o mesmo total e o mesmo texto na sacola, no pedido do WhatsApp e no checkout", async () => {
    const bag = await bagLines([...items], coupon);

    // Bag "Finalizar compra" (checkout closed): a visitor, no login.
    state.userId = null;
    const viaBag = await createWhatsAppOrderAction({ items, couponCode: coupon, customerName: "Ana" });
    expect(viaBag.ok).toBe(true);
    if (!viaBag.ok) return;
    const bagOrder = await recorded(viaBag.orderId);

    // The checkout, finishing on WhatsApp.
    state.userId = CUSTOMER;
    const viaCheckout = await createOrderAction({
      address: ADDRESS,
      method: "whatsapp",
      couponCode: coupon ?? undefined,
      items: [...items],
    });
    expect(viaCheckout.ok).toBe(true);
    if (!viaCheckout.ok) return;
    const checkoutOrder = await recorded(viaCheckout.orderId);

    for (const order of [bagOrder, checkoutOrder]) {
      expect(order.shipping_mode).toBe(mode);
      expect(order.shipping).toBe(0);
      expect(order.total).toBe(total);
      expect(orderSummaryLines(summaryFromOrder(order))).toEqual(bag);
    }

    // Both messages carry the bag's lines, word for word.
    const text = orderSummaryText(summaryFromOrder(bagOrder)).join("\n");
    expect(messageOf(viaBag.url)).toContain(text);
    expect(viaCheckout.payment?.kind).toBe("whatsapp");
    expect(messageOf(viaCheckout.payment!.url)).toContain(text);
  });
});

describe("migration 0007 on orders that already existed", () => {
  it("marks WhatsApp orders a combinar (or free by coupon) and checkout orders with no freight free", async () => {
    const db = state.db;
    await db.insert(orders).values([
      { id: "dddddddd-0000-4000-a000-000000000001", order_number: 901, code: "KS0901", status: "expirado", subtotal: 100, total: 100 },
      { id: "dddddddd-0000-4000-a000-000000000002", order_number: 902, code: "KS0902", status: "expirado", subtotal: 100, total: 100, coupon_code: "FRETE" },
      { id: "dddddddd-0000-4000-a000-000000000003", order_number: 903, status: "pending", subtotal: 100, shipping: 29.9, total: 129.9 },
      { id: "dddddddd-0000-4000-a000-000000000004", order_number: 904, status: "pending", subtotal: 500, shipping: 0, total: 500 },
    ]);

    // The statements after the ALTER, as wrangler will run them.
    const sql = readFileSync(
      path.resolve(__dirname, "../drizzle/migrations/0007_orders_shipping_mode.sql"),
      "utf8",
    );
    const [, ...updates] = sql.split("--> statement-breakpoint");
    const d1 = (db as unknown as { $client: D1Database }).$client;
    for (const statement of updates) await d1.prepare(statement.trim()).run();

    const modes = Object.fromEntries(
      (await db.select({ n: orders.order_number, mode: orders.shipping_mode }).from(orders))
        .filter((row) => row.n > 900)
        .map((row) => [row.n, row.mode]),
    );
    expect(modes).toEqual({ 901: "to_agree", 902: "free", 903: "charged", 904: "free" });
  });
});
