import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/database.types";

export type Order = Tables<"orders">;
export type OrderItem = Tables<"order_items">;
export type OrderWithItems = Order & { order_items: OrderItem[] };

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
