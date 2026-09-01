"use server";

import { revalidatePath } from "next/cache";
import { orderStatusSchema } from "@/lib/validations/order";
import { requireAdmin } from "./require-admin";

export type ActionResult = { ok: boolean; message?: string };

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

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${parsed.data.order_id}`);
  return { ok: true };
}
