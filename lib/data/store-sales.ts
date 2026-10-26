import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, like, lt, or, sql, sum } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/guards";
import { normalizeSearchText } from "@/lib/search-text";
import { LOCAL_SQL_MODIFIER, localToday, type Period } from "@/lib/store-sales/period";
import { BIRTHDAY_WINDOW_DAYS, nextBirthday, type BirthdayInfo } from "@/lib/store-sales/birthday";
import type { StorePaymentMethod } from "@/lib/store-sales/payment-methods";

/**
 * Everything the "Vendas na loja" tab reads. Sales and customers of the
 * physical store live in their own tables (lib/db/schema.ts); a sale undone
 * with "Desfazer baixa" (`canceled_at`) stays in the history and out of
 * every total.
 */

const { store_sales, store_sale_items, store_customers, store_settings, products, product_images, product_variants } =
  schema;

const active = isNull(store_sales.canceled_at);

function inPeriod(period: Pick<Period, "start" | "end">) {
  return and(gte(store_sales.created_at, period.start), lt(store_sales.created_at, period.end));
}

/** First photo of each product, for the lists. */
async function firstImages(productIds: string[]): Promise<Map<string, string>> {
  if (productIds.length === 0) return new Map();
  const rows = await getDb()
    .select({ product_id: product_images.product_id, url: product_images.url, position: product_images.position })
    .from(product_images)
    .where(inArray(product_images.product_id, productIds))
    .orderBy(asc(product_images.position));
  const images = new Map<string, string>();
  for (const row of rows) if (!images.has(row.product_id)) images.set(row.product_id, row.url);
  return images;
}

export type TopProduct = {
  key: string;
  productId: string | null;
  name: string;
  image: string | null;
  qty: number;
  /** What these pieces brought in, with each sale's discount spread over
   * its lines. */
  revenue: number;
  /** The best-selling colour/size pairs of this product. */
  variants: { color: string | null; size: string | null; qty: number }[];
};

export type StoreSaleListItem = {
  id: string;
  sale_number: number;
  created_at: string;
  customer_name: string | null;
  payment_method: StorePaymentMethod;
  subtotal: number;
  discount: number;
  total: number;
  note: string | null;
  created_by: string | null;
  canceled_at: string | null;
  items: { id: string; name: string; color: string | null; size: string | null; qty: number; unit_price: number }[];
};

export type StoreSalesDashboard = {
  revenue: number;
  sales: number;
  pieces: number;
  discount: number;
  averageTicket: number;
  series: { key: string; label: string; total: number; sales: number }[];
  topProducts: TopProduct[];
  byPayment: { method: StorePaymentMethod; sales: number; total: number }[];
  /** Every sale of the period, undone ones included, newest first. */
  list: StoreSaleListItem[];
  /** The list stops at this many. */
  listLimit: number;
};

const TOP_LIMIT = 10;
const LIST_LIMIT = 200;

export async function getStoreSalesDashboard(period: Period): Promise<StoreSalesDashboard> {
  await requireAdminPage();
  const db = getDb();
  const where = and(active, inPeriod(period));
  const bucket = sql<string>`strftime(${period.bucketFormat}, ${store_sales.created_at}, ${LOCAL_SQL_MODIFIER})`;
  const productKey = sql<string>`coalesce(${store_sale_items.product_id}, ${store_sale_items.name})`;
  // A line's share of the sale's total, so 10% off the sale is 10% off
  // each piece in the ranking.
  const lineRevenue = sql<number>`coalesce(sum(${store_sale_items.qty} * ${store_sale_items.unit_price} * (case when ${store_sales.subtotal} > 0 then ${store_sales.total} / ${store_sales.subtotal} else 0 end)), 0)`;

  const [[totals], [pieces], series, top, byPayment] = await db.batch([
    db
      .select({
        sales: count(),
        revenue: sql<number>`coalesce(sum(${store_sales.total}), 0)`,
        discount: sql<number>`coalesce(sum(${store_sales.discount}), 0)`,
      })
      .from(store_sales)
      .where(where),
    db
      .select({ qty: sql<number>`coalesce(sum(${store_sale_items.qty}), 0)` })
      .from(store_sale_items)
      .innerJoin(store_sales, eq(store_sales.id, store_sale_items.sale_id))
      .where(where),
    db
      .select({ bucket, total: sql<number>`coalesce(sum(${store_sales.total}), 0)`, sales: count() })
      .from(store_sales)
      .where(where)
      .groupBy(bucket),
    db
      .select({
        key: productKey,
        productId: sql<string | null>`max(${store_sale_items.product_id})`,
        name: sql<string>`max(${store_sale_items.name})`,
        qty: sql<number>`sum(${store_sale_items.qty})`,
        revenue: lineRevenue,
      })
      .from(store_sale_items)
      .innerJoin(store_sales, eq(store_sales.id, store_sale_items.sale_id))
      .where(where)
      .groupBy(productKey)
      .orderBy(desc(sql`sum(${store_sale_items.qty})`), desc(lineRevenue))
      .limit(TOP_LIMIT),
    db
      .select({
        method: store_sales.payment_method,
        sales: count(),
        total: sql<number>`coalesce(sum(${store_sales.total}), 0)`,
      })
      .from(store_sales)
      .where(where)
      .groupBy(store_sales.payment_method),
  ]);

  const topKeys = top.map((row) => row.key);
  const [variantRows, images, list] = await Promise.all([
    topKeys.length === 0
      ? Promise.resolve([])
      : db
          .select({
            key: productKey,
            color: store_sale_items.color,
            size: store_sale_items.size,
            qty: sql<number>`sum(${store_sale_items.qty})`,
          })
          .from(store_sale_items)
          .innerJoin(store_sales, eq(store_sales.id, store_sale_items.sale_id))
          .where(and(where, inArray(productKey, topKeys)))
          .groupBy(productKey, store_sale_items.color, store_sale_items.size)
          .orderBy(desc(sql`sum(${store_sale_items.qty})`)),
    firstImages(top.flatMap((row) => (row.productId ? [row.productId] : []))),
    db.query.store_sales.findMany({
      where: inPeriod(period),
      orderBy: desc(store_sales.created_at),
      limit: LIST_LIMIT,
      columns: {
        id: true,
        sale_number: true,
        created_at: true,
        customer_name: true,
        payment_method: true,
        subtotal: true,
        discount: true,
        total: true,
        note: true,
        created_by: true,
        canceled_at: true,
      },
      with: {
        items: { columns: { id: true, name: true, color: true, size: true, qty: true, unit_price: true } },
      },
    }),
  ]);

  const seriesByKey = new Map(series.map((row) => [row.bucket, row]));

  return {
    revenue: totals.revenue,
    sales: totals.sales,
    pieces: pieces.qty,
    discount: totals.discount,
    averageTicket: totals.sales > 0 ? totals.revenue / totals.sales : 0,
    series: period.buckets.map((b) => ({
      ...b,
      total: seriesByKey.get(b.key)?.total ?? 0,
      sales: seriesByKey.get(b.key)?.sales ?? 0,
    })),
    topProducts: top.map((row) => ({
      key: row.key,
      productId: row.productId,
      name: row.name,
      image: row.productId ? (images.get(row.productId) ?? null) : null,
      qty: row.qty,
      revenue: row.revenue,
      variants: variantRows
        .filter((v) => v.key === row.key)
        .slice(0, 4)
        .map(({ color, size, qty }) => ({ color, size, qty })),
    })),
    byPayment: byPayment.sort((a, b) => b.total - a.total),
    list,
    listLimit: LIST_LIMIT,
  };
}

/** The year of the first sale, so the year picker starts there. */
export async function getFirstStoreSaleYear(): Promise<number | null> {
  await requireAdminPage();
  const [row] = await getDb()
    .select({ first: sql<string | null>`min(${store_sales.created_at})` })
    .from(store_sales);
  return row?.first ? Number(row.first.slice(0, 4)) : null;
}

// ------------------------------------------------------------------
// the sale form
// ------------------------------------------------------------------

export type StoreProductResult = {
  id: string;
  name: string;
  price: number;
  status: "draft" | "active" | "archived";
  image: string | null;
  variants: { id: string; color: string; size: string; sku: string | null; stock: number }[];
};

/**
 * The product search of "Nova baixa": by name/brand/category like the
 * site's search, or by SKU (a barcode reader types it and presses Enter).
 * Drafts and archived products show up too — a piece can be on the shelf
 * before it is on the site. Only products deleted in the panel are left
 * out.
 */
export async function searchStoreProducts(term: string, limit = 12): Promise<StoreProductResult[]> {
  const raw = term.trim();
  const words = normalizeSearchText(raw)
    .replace(/[%_\\]/g, " ")
    .split(" ")
    .filter(Boolean);
  if (words.join("").length < 2) return [];

  const db = getDb();
  const bySku = db
    .select({ id: product_variants.product_id })
    .from(product_variants)
    .where(and(isNull(product_variants.archived_at), like(product_variants.sku, `%${raw.replace(/[%_\\]/g, "")}%`)));

  const rows = await db.query.products.findMany({
    columns: { id: true, name: true, price: true, status: true },
    where: and(
      isNull(products.deleted_at),
      or(and(...words.map((word) => like(products.search_text, `%${word}%`))), inArray(products.id, bySku)),
    ),
    orderBy: [asc(products.name)],
    limit,
    with: {
      product_variants: {
        columns: { id: true, color: true, size: true, sku: true, stock: true },
        where: isNull(product_variants.archived_at),
      },
      product_images: { columns: { url: true, position: true }, orderBy: asc(product_images.position), limit: 1 },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    price: row.price,
    status: row.status,
    image: row.product_images[0]?.url ?? null,
    variants: row.product_variants,
  }));
}

// ------------------------------------------------------------------
// customers
// ------------------------------------------------------------------

export type StoreCustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  birthdate: string | null;
  birthday_sent_year: number | null;
  created_at: string;
  purchases: number;
  spent: number;
  last_purchase: string | null;
};

export async function getStoreCustomers(search?: string): Promise<StoreCustomerRow[]> {
  await requireAdminPage();
  const db = getDb();
  const term = search?.trim().replace(/[%_\\]/g, "") ?? "";
  const digits = term.replace(/\D/g, "");

  const conditions = term
    ? [
        or(
          like(store_customers.name, `%${term}%`),
          ...(digits.length >= 3 ? [like(store_customers.phone, `%${digits}%`)] : []),
        ),
      ]
    : [];

  return db
    .select({
      id: store_customers.id,
      name: store_customers.name,
      phone: store_customers.phone,
      birthdate: store_customers.birthdate,
      birthday_sent_year: store_customers.birthday_sent_year,
      created_at: store_customers.created_at,
      purchases: count(store_sales.id),
      spent: sql<number>`coalesce(${sum(store_sales.total)}, 0)`,
      last_purchase: sql<string | null>`max(${store_sales.created_at})`,
    })
    .from(store_customers)
    .leftJoin(store_sales, and(eq(store_sales.customer_id, store_customers.id), active))
    .where(and(...conditions))
    .groupBy(store_customers.id)
    .orderBy(asc(sql`lower(${store_customers.name})`))
    .limit(500);
}

export type StoreCustomerOption = { id: string; name: string; phone: string | null };

/** The customer picker of "Nova baixa". */
export async function searchStoreCustomers(term: string): Promise<StoreCustomerOption[]> {
  const clean = term.trim().replace(/[%_\\]/g, "");
  if (clean.length < 2) return [];
  const digits = clean.replace(/\D/g, "");
  return getDb()
    .select({ id: store_customers.id, name: store_customers.name, phone: store_customers.phone })
    .from(store_customers)
    .where(
      or(
        like(store_customers.name, `%${clean}%`),
        ...(digits.length >= 3 ? [like(store_customers.phone, `%${digits}%`)] : []),
      ),
    )
    .orderBy(asc(sql`lower(${store_customers.name})`))
    .limit(8);
}

export type BirthdayRow = {
  id: string;
  name: string;
  phone: string | null;
  birthdate: string;
  sentThisYear: boolean;
} & BirthdayInfo;

/** Customers whose birthday is today or in the next 30 days, soonest first. */
export async function getUpcomingBirthdays(now: Date = new Date()): Promise<BirthdayRow[]> {
  await requireAdminPage();
  const today = localToday(now);
  const rows = await getDb()
    .select({
      id: store_customers.id,
      name: store_customers.name,
      phone: store_customers.phone,
      birthdate: store_customers.birthdate,
      birthday_sent_year: store_customers.birthday_sent_year,
    })
    .from(store_customers)
    .where(isNotNull(store_customers.birthdate));

  return rows
    .map((row) => {
      const info = nextBirthday(row.birthdate!, today);
      return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        birthdate: row.birthdate!,
        // Sent for the birthday in the list, not for last year's.
        sentThisYear: row.birthday_sent_year === Number(info.date.slice(0, 4)),
        ...info,
      };
    })
    .filter((row) => row.daysUntil <= BIRTHDAY_WINDOW_DAYS)
    .sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name, "pt-BR"));
}

export async function getBirthdayMessage(): Promise<string | null> {
  await requireAdminPage();
  const row = await getDb().query.store_settings.findFirst({ where: eq(store_settings.id, 1) });
  return row?.birthday_message ?? null;
}
