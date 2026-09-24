import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderStatus, Tables } from "@/lib/database.types";

export type Order = Tables<"orders">;
export type OrderItem = Tables<"order_items">;
export type OrderWithItems = Order & { order_items: OrderItem[] };

const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "canceled",
  "aguardando_whatsapp",
  "expirado",
];

function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as string[]).includes(value);
}

export async function getMyOrders(): Promise<Order[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export type OrderAdminFilters = {
  status?: string;
  search?: string;
};

/** Admin listing — every order, session-scoped RLS (is_admin() sees all). */
export async function getAllOrdersAdmin(
  filters: OrderAdminFilters = {},
): Promise<Order[]> {
  const supabase = await createClient();
  let query = supabase.from("orders").select("*").order("created_at", { ascending: false });

  if (filters.status && isOrderStatus(filters.status)) {
    query = query.eq("status", filters.status);
  }
  if (filters.search) {
    const term = filters.search.trim();
    const asNumber = Number(term);
    if (!Number.isNaN(asNumber) && term !== "") {
      query = query.eq("order_number", asNumber);
    } else {
      query = query.ilike("customer_snapshot->>name", `%${term}%`);
    }
  }

  const { data } = await query;
  return data ?? [];
}

export async function getOrdersByCustomerAdmin(customerId: string): Promise<Order[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getOrderByIdAdmin(id: string): Promise<OrderWithItems | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .maybeSingle();

  return data as OrderWithItems | null;
}

/**
 * Order confirmation / tracking lookup by id. Order ids are random
 * UUIDs (unguessable), which is the same trust model most storefronts
 * use for "view your order" confirmation links — so this intentionally
 * reads with the service-role client rather than requiring a session,
 * letting a guest-in-the-moment customer land on /pedido/[id] right
 * after paying without having to be logged in on that browser/device.
 */
export async function getOrderForConfirmation(
  id: string,
): Promise<OrderWithItems | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .maybeSingle();

  return data as OrderWithItems | null;
}
