"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { orderStatusSchema } from "@/lib/validations/order";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb, schema } from "@/lib/db";
import { fulfillOrderStock } from "@/lib/orders/stock";
import { runBatch } from "@/lib/db/batch";
import { RELEASED_STATUSES, releaseCouponUse, retakeCouponUse } from "@/lib/coupons/usage";

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

  await requireAdmin();
  const db = getDb();
  try {
    const current = await db.query.orders.findFirst({
      columns: { status: true, coupon_code: true },
      where: eq(schema.orders.id, parsed.data.order_id),
    });
    if (!current) return { ok: false, message: "Pedido não encontrado." };

    // A canceled order gives its coupon use back; reopening it takes one
    // again if there is one left (lib/coupons/usage.ts). Same batch as
    // the status, so the count never drifts from the orders.
    const wasHolding = !RELEASED_STATUSES.has(current.status);
    const willHold = !RELEASED_STATUSES.has(parsed.data.status);
    const coupon =
      current.coupon_code && wasHolding !== willHold
        ? willHold
          ? retakeCouponUse(db, current.coupon_code)
          : releaseCouponUse(db, current.coupon_code)
        : null;

    await runBatch(db, [
      db
        .update(schema.orders)
        .set({
          status: parsed.data.status,
          tracking_code: parsed.data.tracking_code || null,
        })
        .where(eq(schema.orders.id, parsed.data.order_id)),
      ...(coupon ? [coupon] : []),
    ]);
  } catch (error) {
    console.error("[updateOrderStatusAction]", error);
    return { ok: false, message: "Não foi possível atualizar o pedido." };
  }

  if (FULFILLED_STATUSES.has(parsed.data.status)) {
    // Idempotent (guarded by orders.stock_decremented_at), so calling it
    // again as the status moves paid → processing → shipped is a no-op.
    try {
      await fulfillOrderStock(parsed.data.order_id);
    } catch (error) {
      console.error("[updateOrderStatusAction] baixa de estoque falhou", error);
    }
  }

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${parsed.data.order_id}`);
  revalidatePath("/admin/estoque");
  return { ok: true };
}
