import "server-only";
import { and, asc, desc, eq, inArray, like, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { OrderStatus, Tables } from "@/lib/database.types";
import { ORDER_STATUSES } from "@/lib/db/schema";
import { getCurrentUser, requireAdminPage } from "@/lib/auth/guards";

export type Order = Tables<"orders">;
export type OrderItem = Tables<"order_items">;
export type OrderWithItems = Order & { order_items: OrderItem[] };

const { orders } = schema;

function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

/** The signed-in customer's own orders — never anyone else's. */
export async function getMyOrders(): Promise<Order[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  return getDb().query.orders.findMany({
    where: eq(orders.customer_id, user.id),
    orderBy: desc(orders.created_at),
  });
}

export type OrderAdminFilters = {
  status?: string;
  search?: string;
};

/** Admin listing — every order. */
export async function getAllOrdersAdmin(
  filters: OrderAdminFilters = {},
): Promise<OrderWithItems[]> {
  await requireAdminPage();
  const conditions: SQL[] = [];

  if (filters.status && isOrderStatus(filters.status)) {
    conditions.push(eq(orders.status, filters.status));
  }
  if (filters.search) {
    const term = filters.search.trim();
    const asNumber = Number(term);
    if (!Number.isNaN(asNumber) && term !== "") {
      conditions.push(eq(orders.order_number, asNumber));
    } else if (term) {
      conditions.push(
        like(sql`lower(json_extract(${orders.customer_snapshot}, '$.name'))`, `%${term.toLowerCase()}%`),
      );
    }
  }

  // Com os itens: a lista mostra o que foi comprado sem abrir o pedido.
  return getDb().query.orders.findMany({
    where: and(...conditions),
    orderBy: desc(orders.created_at),
    with: { order_items: true },
  });
}

/** D1 aceita no máximo 100 parâmetros por consulta. */
function chunks<T>(list: T[], size = 90): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * A foto de cada item de pedido, para o atendente reconhecer a peça sem
 * abrir o produto: a foto da cor comprada (variação) quando existe, senão
 * a primeira foto do produto. Item cujo produto foi apagado fica sem foto.
 * Chave: id do item do pedido.
 */
export async function getOrderItemPhotos(items: OrderItem[]): Promise<Map<string, string>> {
  const db = getDb();
  const variantIds = [...new Set(items.map((i) => i.variant_id).filter((v): v is string => !!v))];
  const productIds = [...new Set(items.map((i) => i.product_id).filter((v): v is string => !!v))];

  const variantPhoto = new Map<string, string>();
  for (const ids of chunks(variantIds)) {
    const rows = await db
      .select({ id: schema.product_variants.id, url: schema.product_variants.image_url })
      .from(schema.product_variants)
      .where(inArray(schema.product_variants.id, ids));
    for (const row of rows) if (row.url) variantPhoto.set(row.id, row.url);
  }

  const productPhoto = new Map<string, string>();
  for (const ids of chunks(productIds)) {
    const rows = await db
      .select({ productId: schema.product_images.product_id, url: schema.product_images.url })
      .from(schema.product_images)
      .where(inArray(schema.product_images.product_id, ids))
      .orderBy(asc(schema.product_images.position));
    for (const row of rows) if (!productPhoto.has(row.productId)) productPhoto.set(row.productId, row.url);
  }

  const photos = new Map<string, string>();
  for (const item of items) {
    const url =
      (item.variant_id && variantPhoto.get(item.variant_id)) ||
      (item.product_id && productPhoto.get(item.product_id));
    if (url) photos.set(item.id, url);
  }
  return photos;
}

export async function getOrdersByCustomerAdmin(customerId: string): Promise<Order[]> {
  await requireAdminPage();
  return getDb().query.orders.findMany({
    where: eq(orders.customer_id, customerId),
    orderBy: desc(orders.created_at),
  });
}

export async function getOrderByIdAdmin(id: string): Promise<OrderWithItems | null> {
  await requireAdminPage();
  const row = await getDb().query.orders.findFirst({
    where: eq(orders.id, id),
    with: { order_items: true },
  });
  return row ?? null;
}

/**
 * Order confirmation / tracking lookup by id. Order ids are random
 * UUIDs (unguessable), which is the same trust model most storefronts
 * use for "view your order" confirmation links — so this intentionally
 * does not require a session, letting a guest-in-the-moment customer
 * land on /pedido/[id] right after paying without having to be logged in
 * on that browser/device.
 */
export async function getOrderForConfirmation(id: string): Promise<OrderWithItems | null> {
  const row = await getDb().query.orders.findFirst({
    where: eq(orders.id, id),
    with: { order_items: true },
  });
  return row ?? null;
}
