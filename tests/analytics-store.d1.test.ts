import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import { resolveAnalyticsPeriod } from "@/lib/analytics/period";
import { createTestDb } from "./support/d1";

/**
 * Painel → Analytics, the orders side: what counts as an order started, a
 * confirmed sale and a confirmed payment, by channel and by the store's
 * day — read from a real D1.
 */

const state = vi.hoisted(() => ({ db: null as unknown as Db }));
vi.mock("@/lib/db", async () => ({
  getDb: () => state.db,
  schema: await import("@/lib/db/schema"),
}));

const { getStoreAnalytics } = await import("@/lib/analytics/store-data");

let dispose: () => Promise<void>;
beforeAll(async () => {
  const test = await createTestDb();
  state.db = test.db;
  dispose = test.dispose;

  // "Today" is 06/11 in the store (UTC-3); the week is 31/10 → 06/11 and
  // the week before is 24/10 → 30/10.
  let n = 1;
  const order = (fields: Partial<typeof schema.orders.$inferInsert> & { created_at: string }) => ({
    id: `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`,
    order_number: n++,
    subtotal: fields.total ?? 0,
    ...fields,
  });
  const rows = [
    // Paid online — a confirmed sale and a confirmed payment.
    order({ status: "paid", payment_method: "mercadopago", payment_id: "mp-1", total: 300, created_at: "2026-11-06T15:00:00.000Z" }),
    // Shipped later — still a sale of the day it was created.
    order({ status: "shipped", payment_method: "mercadopago", payment_id: "mp-2", total: 100, created_at: "2026-11-01T12:00:00.000Z" }),
    // Confirmed by the store on WhatsApp — a sale, no online payment.
    order({ status: "paid", payment_method: "whatsapp", code: "KS0003", total: 200, created_at: "2026-11-05T18:00:00.000Z" }),
    // Started, never confirmed.
    order({ status: "aguardando_whatsapp", payment_method: "whatsapp", code: "KS0004", total: 150, created_at: "2026-11-06T10:00:00.000Z" }),
    order({ status: "expirado", payment_method: "whatsapp", code: "KS0005", total: 80, created_at: "2026-11-02T10:00:00.000Z" }),
    order({ status: "pending", payment_method: "mercadopago", total: 90, created_at: "2026-11-03T10:00:00.000Z" }),
    order({ status: "canceled", payment_method: "mercadopago", total: 60, created_at: "2026-11-04T10:00:00.000Z" }),
    // 22:30 on 06/11 in the store = 01:30 on 07/11 UTC: still today.
    order({ status: "paid", payment_method: "mercadopago", payment_id: "mp-8", total: 50, created_at: "2026-11-07T01:30:00.000Z" }),
    // Previous week.
    order({ status: "delivered", payment_method: "mercadopago", payment_id: "mp-9", total: 400, created_at: "2026-10-28T12:00:00.000Z" }),
    // Before both periods: ignored.
    order({ status: "paid", payment_method: "mercadopago", payment_id: "mp-10", total: 999, created_at: "2026-10-01T12:00:00.000Z" }),
  ];
  // One by one: D1 binds at most 100 parameters per statement.
  for (const row of rows) await state.db.insert(schema.orders).values(row);
});
afterAll(async () => {
  await dispose?.();
});

describe("getStoreAnalytics", () => {
  it("separates started, confirmed and paid, by channel", async () => {
    const period = resolveAnalyticsPeriod({ periodo: "7d" }, new Date("2026-11-07T02:00:00.000Z"));
    const result = await getStoreAnalytics(period);
    expect(result.current).toEqual({
      started: 8,
      startedByChannel: { site: 5, whatsapp: 3 },
      confirmed: 4,
      confirmedByChannel: { site: 3, whatsapp: 1 },
      paymentsConfirmed: 3,
      revenue: 650,
      revenueByChannel: { site: 450, whatsapp: 200 },
      averageTicket: 162.5,
    });
    expect(result.previous).toMatchObject({ started: 1, confirmed: 1, revenue: 400, paymentsConfirmed: 1 });
  });

  it("buckets by the store's day", async () => {
    const period = resolveAnalyticsPeriod({ periodo: "7d" }, new Date("2026-11-07T02:00:00.000Z"));
    const { daily } = await getStoreAnalytics(period);
    expect(daily).toHaveLength(7);
    expect(daily.find((d) => d.day === "2026-11-06")).toEqual({ day: "2026-11-06", started: 3, confirmed: 2, revenue: 350 });
    expect(daily.find((d) => d.day === "2026-10-31")).toEqual({ day: "2026-10-31", started: 0, confirmed: 0, revenue: 0 });
    expect(daily.reduce((sum, d) => sum + d.revenue, 0)).toBe(650);
  });

  it("an empty day has no sales and no ticket", async () => {
    const period = resolveAnalyticsPeriod({ periodo: "personalizado", de: "2026-10-31", ate: "2026-10-31" }, new Date("2026-11-07T02:00:00.000Z"));
    const result = await getStoreAnalytics(period);
    expect(result.current.confirmed).toBe(0);
    expect(result.current.averageTicket).toBe(0);
  });
});
