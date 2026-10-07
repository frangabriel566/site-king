import "server-only";
import { and, desc, eq, like, sql, type SQL } from "drizzle-orm";
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
export async function getAllOrdersAdmin(filters: OrderAdminFilters = {}): Promise<Order[]> {
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

  return getDb().query.orders.findMany({
    where: and(...conditions),
    orderBy: desc(orders.created_at),
  });
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
