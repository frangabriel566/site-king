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
 * order its "Finalizar compra" creates, and the checkout — order rows and
 * messages alike. The checkout adds the Melhor Envio freight picked (the
 * cheapest option free when the store's rule or the coupon covers it);
 * the products' part is the same as the bag's to the cent.
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
// Open the checkout here (in production it follows Admin → Integrações).
vi.mock("@/lib/sales-mode", () => ({
  getSalesMode: () => ({ freightQuotes: true, checkoutOpen: true }),
}));
// Melhor Envio stands in with two fixed options; the quote's own rules
// (CEP, weights, errors) are the route's and the client's business.
const QUOTES = [
  { serviceId: 1, name: "PAC", company: "Correios", companyPicture: null, price: 25.5, deliveryDays: 7 },
  { serviceId: 2, name: "SEDEX", company: "Correios", companyPicture: null, price: 48.9, deliveryDays: 3 },
];
vi.mock("@/lib/shipping/quote", () => ({
  quoteFreight: async (cep: string) => ({ ok: true, cep, quotes: QUOTES }),
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

    // The checkout, cheapest freight (PAC), finishing on WhatsApp.
    state.userId = CUSTOMER;
    const freight = mode === "free" ? 0 : 25.5;
    const viaCheckout = await createOrderAction({
      address: ADDRESS,
      method: "whatsapp",
      couponCode: coupon ?? undefined,
      freight: { serviceId: 1, expectedPrice: freight },
      items: [...items],
    });
    expect(viaCheckout.ok).toBe(true);
    if (!viaCheckout.ok) return;
    const checkoutOrder = await recorded(viaCheckout.orderId);

    expect(bagOrder.shipping_mode).toBe(mode);
    expect(bagOrder.shipping).toBe(0);
    expect(bagOrder.total).toBe(total);
    expect(orderSummaryLines(summaryFromOrder(bagOrder))).toEqual(bag);

    // Same products, discount and coupon; the freight is now a price.
    expect(checkoutOrder.shipping_mode).toBe(mode === "free" ? "free" : "charged");
    expect(checkoutOrder.shipping).toBe(freight);
    expect(checkoutOrder.total).toBe(total + freight);
    expect(checkoutOrder.subtotal).toBe(bagOrder.subtotal);
    expect(checkoutOrder.discount).toBe(bagOrder.discount);
    expect(checkoutOrder.shipping_service).toBe("1");
    expect(checkoutOrder.shipping_address?.freight).toMatchObject({ service_id: 1, name: "PAC", days: 7 });

    // Each message carries its own order's lines, word for word.
    expect(messageOf(viaBag.url)).toContain(orderSummaryText(summaryFromOrder(bagOrder)).join("\n"));
    expect(viaCheckout.payment?.kind).toBe("whatsapp");
    expect(messageOf(viaCheckout.payment!.url)).toContain(
      orderSummaryText(summaryFromOrder(checkoutOrder)).join("\n"),
    );
  });
});

describe("o frete do checkout", () => {
  const items = [{ variantId: V1, qty: 2 }, { variantId: V2, qty: 1 }]; // R$ 420: frete grátis

  it("o grátis vale só para a opção mais barata; a mais rápida é cobrada", async () => {
    state.userId = CUSTOMER;
    const result = await createOrderAction({
      address: ADDRESS,
      method: "whatsapp",
      freight: { serviceId: 2, expectedPrice: 48.9 },
      items,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const order = await recorded(result.orderId);
    expect(order.shipping_mode).toBe("charged");
    expect(order.shipping).toBe(48.9);
    expect(order.total).toBe(468.9);
  });

  it("recusa sem opção, com opção que sumiu ou com preço diferente do que o cliente viu", async () => {
    state.userId = CUSTOMER;
    const base = { address: ADDRESS, method: "whatsapp" as const, items };
    for (const freight of [undefined, { serviceId: 99, expectedPrice: 10 }, { serviceId: 2, expectedPrice: 30 }]) {
      const result = await createOrderAction({ ...base, freight });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.freightChanged).toBe(true);
    }
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
