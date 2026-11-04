import "server-only";
import { and, gte, inArray, isNull, lt } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { CONFIRMED_ORDER_STATUSES } from "@/lib/constants";
import { roundMoney } from "@/lib/money";
import { localIso } from "@/lib/store-sales/period";
import { STORE_PAYMENT_LABEL } from "@/lib/store-sales/payment-methods";
import { sitePaymentLabel, type ReportPeriod } from "@/lib/reports/period";

/**
 * Painel → Relatórios. Site sales are the confirmed orders (paid and
 * after, the same ones the Dashboard counts); store sales are "Vendas na
 * loja" minus the undone ones. Both are read whole for the period and
 * summed here: a year of a single store is a few thousand rows at most.
 */

export type ReportSale = {
  id: string;
  origin: "site" | "loja";
  /** "Pedido #123" / "Venda #45". */
  number: string;
  createdAt: string;
  customer: string;
  payment: string;
  pieces: number;
  discount: number;
  shipping: number;
  total: number;
};

export type SourceTotals = { revenue: number; sales: number; pieces: number };

export type SalesReport = {
  totals: SourceTotals & { averageTicket: number; discount: number };
  site: SourceTotals;
  loja: SourceTotals;
  chart: { key: string; site: number; loja: number; sales: number }[];
  payments: { label: string; total: number; sales: number }[];
  topProducts: { name: string; qty: number; revenue: number }[];
  /** Newest first. */
  sales: ReportSale[];
};

const { orders, order_items, store_sales, store_sale_items } = schema;

function empty(): SourceTotals {
  return { revenue: 0, sales: 0, pieces: 0 };
}

/** Callers check the admin first: the page with requireAdminPage, the
 * spreadsheet route with requireAdmin. */
export async function getSalesReport(period: ReportPeriod): Promise<SalesReport> {
  const db = getDb();
  const wantSite = period.source !== "loja";
  const wantLoja = period.source !== "site";

  const siteOrders = wantSite
    ? await db
        .select({
          id: orders.id,
          number: orders.order_number,
          created_at: orders.created_at,
          total: orders.total,
          discount: orders.discount,
          shipping: orders.shipping,
          payment_method: orders.payment_method,
          customer: orders.customer_snapshot,
        })
        .from(orders)
        .where(
          and(
            inArray(orders.status, CONFIRMED_ORDER_STATUSES),
            gte(orders.created_at, period.start),
            lt(orders.created_at, period.end),
          ),
        )
    : [];
  const storeSales = wantLoja
    ? await db
        .select({
          id: store_sales.id,
          number: store_sales.sale_number,
          created_at: store_sales.created_at,
          total: store_sales.total,
          discount: store_sales.discount,
          payment_method: store_sales.payment_method,
          customer: store_sales.customer_name,
        })
        .from(store_sales)
        .where(
          and(
            isNull(store_sales.canceled_at),
            gte(store_sales.created_at, period.start),
            lt(store_sales.created_at, period.end),
          ),
        )
    : [];

  // Items in chunks: D1 binds at most 100 parameters per statement.
  type Item = { parent: string; name: string; qty: number; unit_price: number };
  async function itemsOf(
    ids: string[],
    load: (chunk: string[]) => Promise<Item[]>,
  ): Promise<Item[]> {
    const all: Item[] = [];
    for (let i = 0; i < ids.length; i += 90) all.push(...(await load(ids.slice(i, i + 90))));
    return all;
  }
  const [siteItems, storeItems] = await Promise.all([
    itemsOf(
      siteOrders.map((o) => o.id),
      (chunk) =>
        db
          .select({
            parent: order_items.order_id,
            name: order_items.name,
            qty: order_items.qty,
            unit_price: order_items.unit_price,
          })
          .from(order_items)
          .where(inArray(order_items.order_id, chunk)),
    ),
    itemsOf(
      storeSales.map((s) => s.id),
      (chunk) =>
        db
          .select({
            parent: store_sale_items.sale_id,
            name: store_sale_items.name,
            qty: store_sale_items.qty,
            unit_price: store_sale_items.unit_price,
          })
          .from(store_sale_items)
          .where(inArray(store_sale_items.sale_id, chunk)),
    ),
  ]);

  const piecesBy = new Map<string, number>();
  const products = new Map<string, { qty: number; revenue: number }>();
  for (const item of [...siteItems, ...storeItems]) {
    piecesBy.set(item.parent, (piecesBy.get(item.parent) ?? 0) + item.qty);
    const entry = products.get(item.name) ?? { qty: 0, revenue: 0 };
    entry.qty += item.qty;
    entry.revenue += item.qty * item.unit_price;
    products.set(item.name, entry);
  }

  const sales: ReportSale[] = [
    ...siteOrders.map((o) => ({
      id: o.id,
      origin: "site" as const,
      number: `Pedido #${o.number}`,
      createdAt: o.created_at,
      customer: o.customer?.name?.trim() || "—",
      payment: sitePaymentLabel(o.payment_method),
      pieces: piecesBy.get(o.id) ?? 0,
      discount: o.discount,
      shipping: o.shipping,
      total: o.total,
    })),
    ...storeSales.map((s) => ({
      id: s.id,
      origin: "loja" as const,
      number: `Venda #${s.number}`,
      createdAt: s.created_at,
      customer: s.customer?.trim() || "—",
      payment: STORE_PAYMENT_LABEL[s.payment_method] ?? s.payment_method,
      pieces: piecesBy.get(s.id) ?? 0,
      discount: s.discount,
      shipping: 0,
      total: s.total,
    })),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const site = empty();
  const loja = empty();
  const chart = new Map(period.buckets.map((b) => [b.key, { key: b.key, site: 0, loja: 0, sales: 0 }]));
  const payments = new Map<string, { label: string; total: number; sales: number }>();
  let discount = 0;
  const bucketLength = period.bucketFormat === "%Y-%m-%d" ? 10 : 7;

  for (const sale of sales) {
    const totals = sale.origin === "site" ? site : loja;
    totals.revenue += sale.total;
    totals.sales += 1;
    totals.pieces += sale.pieces;
    discount += sale.discount;

    const column = chart.get(localIso(sale.createdAt).slice(0, bucketLength));
    if (column) {
      column[sale.origin] += sale.total;
      column.sales += 1;
    }

    const label = sale.origin === "site" ? `${sale.payment} (site)` : sale.payment;
    const pay = payments.get(label) ?? { label, total: 0, sales: 0 };
    pay.total += sale.total;
    pay.sales += 1;
    payments.set(label, pay);
  }

  const revenue = site.revenue + loja.revenue;
  const count = site.sales + loja.sales;
  return {
    totals: {
      revenue: roundMoney(revenue),
      sales: count,
      pieces: site.pieces + loja.pieces,
      averageTicket: count > 0 ? roundMoney(revenue / count) : 0,
      discount: roundMoney(discount),
    },
    site: { ...site, revenue: roundMoney(site.revenue) },
    loja: { ...loja, revenue: roundMoney(loja.revenue) },
    chart: [...chart.values()].map((c) => ({
      ...c,
      site: roundMoney(c.site),
      loja: roundMoney(c.loja),
    })),
    payments: [...payments.values()]
      .map((p) => ({ ...p, total: roundMoney(p.total) }))
      .sort((a, b) => b.total - a.total),
    topProducts: [...products]
      .map(([name, p]) => ({ name, qty: p.qty, revenue: roundMoney(p.revenue) }))
      .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
      .slice(0, 10),
    sales,
  };
}
