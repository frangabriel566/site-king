import { createClient } from "@/lib/supabase/server";
import { LOW_STOCK_THRESHOLD } from "@/lib/constants";
import type { OrderStatus } from "@/lib/database.types";

const PAID_STATUSES: OrderStatus[] = ["paid", "processing", "shipped", "delivered"];

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

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();
  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = startOfMonth(now);
  const rangeStart = new Date(todayStart);
  rangeStart.setDate(rangeStart.getDate() - 29);

  const [{ data: monthOrders }, { data: statusRows }, { data: variants }] = await Promise.all([
    supabase
      .from("orders")
      .select("total, status, created_at")
      .in("status", PAID_STATUSES)
      .gte("created_at", monthStart.toISOString()),
    supabase.from("orders").select("status"),
    supabase.from("product_variants").select("stock"),
  ]);

  const salesToday = (monthOrders ?? [])
    .filter((o) => new Date(o.created_at) >= todayStart)
    .reduce((sum, o) => sum + o.total, 0);

  const salesMonth = (monthOrders ?? []).reduce((sum, o) => sum + o.total, 0);
  const averageTicket = monthOrders && monthOrders.length > 0 ? salesMonth / monthOrders.length : 0;

  const ordersByStatus: Record<string, number> = {};
  for (const row of statusRows ?? []) {
    ordersByStatus[row.status] = (ordersByStatus[row.status] ?? 0) + 1;
  }

  const lowStockCount = (variants ?? []).filter((v) => v.stock <= LOW_STOCK_THRESHOLD).length;

  const { data: last30 } = await supabase
    .from("orders")
    .select("total, created_at")
    .in("status", PAID_STATUSES)
    .gte("created_at", rangeStart.toISOString());

  const byDay = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + i);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const order of last30 ?? []) {
    const key = order.created_at.slice(0, 10);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + order.total);
  }

  const dailySales = Array.from(byDay, ([date, total]) => ({ date, total }));

  return {
    salesToday,
    salesMonth,
    averageTicket,
    ordersByStatus,
    lowStockCount,
    dailySales,
  };
}
