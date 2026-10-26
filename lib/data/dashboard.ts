import "server-only";
import { and, count, gte, inArray, isNull, lte } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { CONFIRMED_ORDER_STATUSES, LOW_STOCK_THRESHOLD } from "@/lib/constants";
import { requireAdminPage } from "@/lib/auth/guards";
import { localBounds, localIso } from "@/lib/store-sales/period";

export type DashboardStats = {
  /** Site orders (paid and after). */
  salesToday: number;
  salesMonth: number;
  averageTicket: number;
  /** Counter sales (Vendas na loja), never mixed into the site's numbers. */
  storeSalesToday: number;
  storeSalesMonth: number;
  ordersByStatus: Record<string, number>;
  lowStockCount: number;
  dailySales: { date: string; total: number }[];
};

const { orders, product_variants, store_sales } = schema;

export async function getDashboardStats(): Promise<DashboardStats> {
  await requireAdminPage();
  const db = getDb();
  // Today and this month in the store's clock (UTC-3), not the Worker's
  // UTC — a sale at 22:00 belongs to today (lib/store-sales/period.ts).
  const { dayStart: todayStart, monthStart } = localBounds();
  const rangeStart = new Date(todayStart);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 29);
  // Timestamps are ISO strings in UTC, so they compare as text.
  const since = rangeStart < monthStart ? rangeStart : monthStart;

  const [paidOrders, statusRows, [{ lowStock }], storeSales] = await db.batch([
    db
      .select({ total: orders.total, created_at: orders.created_at })
      .from(orders)
      .where(and(inArray(orders.status, CONFIRMED_ORDER_STATUSES), gte(orders.created_at, since.toISOString()))),
    db.select({ status: orders.status, count: count() }).from(orders).groupBy(orders.status),
    db
      .select({ lowStock: count() })
      .from(product_variants)
      .where(and(lte(product_variants.stock, LOW_STOCK_THRESHOLD), isNull(product_variants.archived_at))),
    db
      .select({ total: store_sales.total, created_at: store_sales.created_at })
      .from(store_sales)
      .where(and(isNull(store_sales.canceled_at), gte(store_sales.created_at, monthStart.toISOString()))),
  ]);

  const monthOrders = paidOrders.filter((o) => new Date(o.created_at) >= monthStart);
  const salesToday = monthOrders
    .filter((o) => new Date(o.created_at) >= todayStart)
    .reduce((sum, o) => sum + o.total, 0);
  const salesMonth = monthOrders.reduce((sum, o) => sum + o.total, 0);
  const averageTicket = monthOrders.length > 0 ? salesMonth / monthOrders.length : 0;

  const storeSalesMonth = storeSales.reduce((sum, s) => sum + s.total, 0);
  const storeSalesToday = storeSales
    .filter((s) => new Date(s.created_at) >= todayStart)
    .reduce((sum, s) => sum + s.total, 0);

  const ordersByStatus: Record<string, number> = {};
  for (const row of statusRows) ordersByStatus[row.status] = row.count;

  const byDay = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(rangeStart);
    d.setUTCDate(d.getUTCDate() + i);
    byDay.set(localIso(d).slice(0, 10), 0);
  }
  for (const order of paidOrders) {
    if (new Date(order.created_at) < rangeStart) continue;
    const key = localIso(order.created_at).slice(0, 10);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + order.total);
  }

  return {
    salesToday,
    salesMonth,
    averageTicket,
    storeSalesToday,
    storeSalesMonth,
    ordersByStatus,
    lowStockCount: lowStock,
    dailySales: Array.from(byDay, ([date, total]) => ({ date, total })),
  };
}
