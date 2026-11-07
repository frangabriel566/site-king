import "server-only";
import { and, gte, lt } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { CONFIRMED_ORDER_STATUSES } from "@/lib/constants";
import type { OrderStatus } from "@/lib/db/schema";
import { roundMoney } from "@/lib/money";
import { localIso } from "@/lib/store-sales/period";
import type { AnalyticsPeriod, DaySpan } from "./period";

/**
 * The site's orders, from the database — the panel's only source for
 * sales and revenue (GA4's `purchase` only sees the shoppers who came back
 * to the order page with cookies allowed). Same rules as Relatórios:
 * an order belongs to the day it was created (store clock), and it is a
 * sale once confirmed (paid and after).
 *
 * - Pedidos iniciados: every order created, whatever happened to it.
 * - Pedidos confirmados: confirmed — paid online or confirmed by the store
 *   on WhatsApp.
 * - Pagamentos confirmados: confirmed with a payment the store's payment
 *   provider (Mercado Pago) reported as approved.
 *
 * A WhatsApp click is none of these; it is counted by GA4 only.
 */

export type Channel = "site" | "whatsapp";

export type StoreTotals = {
  started: number;
  startedByChannel: Record<Channel, number>;
  confirmed: number;
  confirmedByChannel: Record<Channel, number>;
  paymentsConfirmed: number;
  revenue: number;
  revenueByChannel: Record<Channel, number>;
  averageTicket: number;
};

export type StoreAnalytics = {
  current: StoreTotals;
  previous: StoreTotals;
  daily: { day: string; started: number; confirmed: number; revenue: number }[];
};

export type OrderRow = {
  status: OrderStatus;
  payment_method: string | null;
  payment_id: string | null;
  total: number;
  created_at: string;
};

const CONFIRMED = new Set<OrderStatus>(CONFIRMED_ORDER_STATUSES);

function channelOf(row: OrderRow): Channel {
  return row.payment_method === "whatsapp" ? "whatsapp" : "site";
}

function empty(): StoreTotals {
  return {
    started: 0,
    startedByChannel: { site: 0, whatsapp: 0 },
    confirmed: 0,
    confirmedByChannel: { site: 0, whatsapp: 0 },
    paymentsConfirmed: 0,
    revenue: 0,
    revenueByChannel: { site: 0, whatsapp: 0 },
    averageTicket: 0,
  };
}

function within(row: OrderRow, span: DaySpan) {
  return row.created_at >= span.start && row.created_at < span.end;
}

function totalsOf(rows: OrderRow[]): StoreTotals {
  const totals = empty();
  for (const row of rows) {
    const channel = channelOf(row);
    totals.started += 1;
    totals.startedByChannel[channel] += 1;
    if (!CONFIRMED.has(row.status)) continue;
    totals.confirmed += 1;
    totals.confirmedByChannel[channel] += 1;
    totals.revenue += row.total;
    totals.revenueByChannel[channel] += row.total;
    if (row.payment_method === "mercadopago" && row.payment_id) totals.paymentsConfirmed += 1;
  }
  totals.revenue = roundMoney(totals.revenue);
  totals.revenueByChannel.site = roundMoney(totals.revenueByChannel.site);
  totals.revenueByChannel.whatsapp = roundMoney(totals.revenueByChannel.whatsapp);
  totals.averageTicket = totals.confirmed > 0 ? roundMoney(totals.revenue / totals.confirmed) : 0;
  return totals;
}

/** Pure: rows covering both periods → the page's numbers. Exported for tests. */
export function aggregateOrders(rows: OrderRow[], period: AnalyticsPeriod): StoreAnalytics {
  const current = rows.filter((row) => within(row, period));
  const previous = rows.filter((row) => within(row, period.previous));

  const byDay = new Map(period.days.map((day) => [day, { day, started: 0, confirmed: 0, revenue: 0 }]));
  for (const row of current) {
    const bucket = byDay.get(localIso(row.created_at).slice(0, 10));
    if (!bucket) continue;
    bucket.started += 1;
    if (CONFIRMED.has(row.status)) {
      bucket.confirmed += 1;
      bucket.revenue = roundMoney(bucket.revenue + row.total);
    }
  }

  return { current: totalsOf(current), previous: totalsOf(previous), daily: [...byDay.values()] };
}

/** Callers check the admin first (requireAdminPage on the page). */
export async function getStoreAnalytics(period: AnalyticsPeriod): Promise<StoreAnalytics> {
  const { orders } = schema;
  // Both periods in one read: they are contiguous.
  const rows = await getDb()
    .select({
      status: orders.status,
      payment_method: orders.payment_method,
      payment_id: orders.payment_id,
      total: orders.total,
      created_at: orders.created_at,
    })
    .from(orders)
    .where(and(gte(orders.created_at, period.previous.start), lt(orders.created_at, period.end)));
  return aggregateOrders(rows, period);
}
