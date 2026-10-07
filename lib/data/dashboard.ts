import "server-only";
import { and, count, gte, inArray, lte } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { CONFIRMED_ORDER_STATUSES, LOW_STOCK_THRESHOLD } from "@/lib/constants";
import { requireAdminPage } from "@/lib/auth/guards";

export type DashboardStats = {
  salesToday: number;
  salesMonth: number;
  averageTicket: number;
  ordersByStatus: Record<string, number>;
  lowStockCount: number;
  dailySales: { date: string; total: number }[];
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

const { orders, product_variants } = schema;

export async function getDashboardStats(): Promise<DashboardStats> {
  await requireAdminPage();
  const db = getDb();
  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = startOfMonth(now);
  const rangeStart = new Date(todayStart);
  rangeStart.setDate(rangeStart.getDate() - 29);
  // Timestamps are ISO strings in UTC, so they compare as text.
  const since = rangeStart < monthStart ? rangeStart : monthStart;

  const [paidOrders, statusRows, [{ lowStock }]] = await db.batch([
    db
      .select({ total: orders.total, created_at: orders.created_at })
      .from(orders)
      .where(and(inArray(orders.status, CONFIRMED_ORDER_STATUSES), gte(orders.created_at, since.toISOString()))),
    db.select({ status: orders.status, count: count() }).from(orders).groupBy(orders.status),
    db
      .select({ lowStock: count() })
      .from(product_variants)
      .where(lte(product_variants.stock, LOW_STOCK_THRESHOLD)),
  ]);

  const monthOrders = paidOrders.filter((o) => new Date(o.created_at) >= monthStart);
  const salesToday = monthOrders
    .filter((o) => new Date(o.created_at) >= todayStart)
    .reduce((sum, o) => sum + o.total, 0);
  const salesMonth = monthOrders.reduce((sum, o) => sum + o.total, 0);
  const averageTicket = monthOrders.length > 0 ? salesMonth / monthOrders.length : 0;

  const ordersByStatus: Record<string, number> = {};
  for (const row of statusRows) ordersByStatus[row.status] = row.count;

  const byDay = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + i);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const order of paidOrders) {
    if (new Date(order.created_at) < rangeStart) continue;
    const key = order.created_at.slice(0, 10);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + order.total);
  }

  return {
    salesToday,
    salesMonth,
    averageTicket,
    ordersByStatus,
    lowStockCount: lowStock,
    dailySales: Array.from(byDay, ([date, total]) => ({ date, total })),
  };
}
