"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
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

/**
 * Lixeira da lista de pedidos: apaga o pedido de vez. Se a baixa de estoque
 * já tinha sido feita (pedido pago), as peças voltam ao estoque; se o cupom
 * tinha sido contado, o uso é devolvido. Tudo num batch só — ou vai tudo,
 * ou nada muda.
 */
export async function deleteOrderAction(orderId: unknown): Promise<ActionResult> {
  if (typeof orderId !== "string" || !orderId) {
    return { ok: false, message: "Pedido inválido." };
  }

  await requireAdmin();
  const db = getDb();
  const { orders, order_items, product_variants } = schema;
  try {
    const order = await db.query.orders.findFirst({
      columns: { id: true, code: true, order_number: true, stock_decremented_at: true },
      where: eq(orders.id, orderId),
      with: { order_items: { columns: { variant_id: true, qty: true } } },
    });
    if (!order) return { ok: false, message: "Pedido não encontrado." };

    const restock = order.stock_decremented_at
      ? order.order_items.filter((item) => item.variant_id)
      : [];
    const stillDecremented = sql`exists (select 1 from ${orders} where ${orders.id} = ${orderId} and ${orders.stock_decremented_at} is not null)`;

    await runBatch(db, [
      ...releaseCouponUse(db, orderId),
      ...restock.map((item) =>
        db
          .update(product_variants)
          .set({ stock: sql`${product_variants.stock} + ${item.qty}` })
          .where(and(eq(product_variants.id, item.variant_id!), stillDecremented)),
      ),
      db.delete(order_items).where(eq(order_items.order_id, orderId)),
      db.delete(orders).where(eq(orders.id, orderId)),
    ]);

    revalidatePath("/admin/pedidos");
    revalidatePath("/admin/estoque");
    revalidatePath("/admin");
    const label = `#${order.code ?? order.order_number}`;
    const pieces = restock.reduce((sum, item) => sum + item.qty, 0);
    return {
      ok: true,
      message:
        pieces > 0
          ? `Pedido ${label} excluído. ${pieces} ${pieces === 1 ? "peça voltou" : "peças voltaram"} ao estoque.`
          : `Pedido ${label} excluído.`,
    };
  } catch (error) {
    console.error("[deleteOrderAction]", error);
    return { ok: false, message: "Não foi possível excluir o pedido." };
  }
}
