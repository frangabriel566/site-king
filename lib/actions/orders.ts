"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { orderStatusSchema } from "@/lib/validations/order";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb, schema } from "@/lib/db";
import { fulfillOrderStock } from "@/lib/orders/stock";
import { runBatch } from "@/lib/db/batch";
import {
  COUNTED_STATUSES,
  RELEASED_STATUSES,
  countCouponUse,
  isCouponLimitError,
  releaseCouponUse,
} from "@/lib/coupons/usage";

export type ActionResult = { ok: boolean; message?: string };

// Statuses that mean payment was received — stock must be decremented by
// the time an order reaches any of these. The Mercado Pago webhook is the
// only other place this happens; orders paid through the WhatsApp
// provider are confirmed manually here instead, so this is the only
// fulfillment trigger they ever get.
const FULFILLED_STATUSES = COUNTED_STATUSES;

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

    // The coupon use follows the sale (lib/coupons/usage.ts): counted when
    // the order becomes paid, given back when a counted order is canceled.
    // Both are no-ops when there is nothing to do, and they share the
    // status's batch, so the count never drifts from the orders.
    const coupon = COUNTED_STATUSES.has(parsed.data.status)
      ? countCouponUse(db, parsed.data.order_id)
      : RELEASED_STATUSES.has(parsed.data.status)
        ? releaseCouponUse(db, parsed.data.order_id)
        : [];

    await runBatch(db, [
      ...coupon,
      db
        .update(schema.orders)
        .set({
          status: parsed.data.status,
          tracking_code: parsed.data.tracking_code || null,
        })
        .where(eq(schema.orders.id, parsed.data.order_id)),
    ]);
  } catch (error) {
    if (isCouponLimitError(error)) {
      return {
        ok: false,
        message:
          "O cupom deste pedido já atingiu o limite de usos. Aumente o limite em Cupons para marcar a venda.",
      };
    }
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

const SYNC_MESSAGE: Record<string, string> = {
  paid: "Pagamento confirmado no Mercado Pago. Pedido marcado como pago.",
  already_paid: "Este pedido já estava pago.",
  payment_id_recorded: "O Mercado Pago tem o pagamento, mas ainda não aprovado.",
  not_found: "Nenhum pagamento encontrado no Mercado Pago para este pedido.",
  no_order: "Pedido não encontrado.",
  not_configured: "Mercado Pago não configurado em Integrações.",
  error: "Não foi possível consultar o Mercado Pago agora. Tente de novo.",
};

/** Botão "Verificar pagamento": consulta o Mercado Pago sem esperar o webhook. */
export async function syncOrderPaymentAction(orderId: string): Promise<ActionResult> {
  await requireAdmin();
  const { syncOrderPayment } = await import("@/lib/payments/sync");
  const outcome = await syncOrderPayment(orderId);
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin/pedidos");
  return {
    ok: outcome === "paid" || outcome === "already_paid",
    message: SYNC_MESSAGE[outcome] ?? outcome,
  };
}
