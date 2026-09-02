"use server";

import { revalidatePath } from "next/cache";
import { orderStatusSchema } from "@/lib/validations/order";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "./require-admin";

export type ActionResult = { ok: boolean; message?: string };

// Statuses that mean payment was received — stock must be decremented by
// the time an order reaches any of these. The Mercado Pago webhook is the
// only other place this happens; orders paid through the WhatsApp
// provider are confirmed manually here instead, so this is the only
// fulfillment trigger they ever get.
const FULFILLED_STATUSES = new Set(["paid", "processing", "shipped", "delivered"]);

export async function updateOrderStatusAction(
  input: unknown,
): Promise<ActionResult> {
  const parsed = orderStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("orders")
    .update({
      status: parsed.data.status,
      tracking_code: parsed.data.tracking_code || null,
    })
    .eq("id", parsed.data.order_id);

  if (error) return { ok: false, message: error.message };

  if (FULFILLED_STATUSES.has(parsed.data.status)) {
    // fulfill_order_stock's execute grant was revoked from `public` (see
    // 0003_functions.sql) — only the service-role client can call it, same
    // as the Mercado Pago webhook. Safe here because requireAdmin() above
    // already confirmed the caller is an admin; the RPC itself is
    // idempotent (guarded by orders.stock_decremented_at), so calling it
    // again as the status moves paid → processing → shipped is a no-op.
    const admin = createAdminClient();
    const { error: stockError } = await admin.rpc("fulfill_order_stock", {
      p_order_id: parsed.data.order_id,
    });
    if (stockError) {
      console.error("[updateOrderStatusAction] fulfill_order_stock failed", stockError);
    }
  }

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${parsed.data.order_id}`);
  revalidatePath("/admin/estoque");
  return { ok: true };
}
