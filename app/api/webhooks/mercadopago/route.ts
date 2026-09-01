import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyMercadoPagoSignature } from "@/lib/payments/verify-mercadopago-signature";
import { sendOrderConfirmationEmail } from "@/lib/email";

export const runtime = "nodejs";

type MercadoPagoPayment = {
  id: number;
  status: string;
  external_reference: string | null;
  payer?: { email?: string };
};

async function fetchPayment(paymentId: string): Promise<MercadoPagoPayment | null> {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) return null;

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as MercadoPagoPayment;
}

export async function POST(request: NextRequest) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const rawBody = await request.text();

  let body: { type?: string; action?: string; data?: { id?: string } } = {};
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const dataId =
    body.data?.id ?? request.nextUrl.searchParams.get("data.id") ?? null;
  const eventType = body.type ?? request.nextUrl.searchParams.get("type");

  if (eventType !== "payment" || !dataId) {
    // Ignore any other notification type (merchant_order, test pings, etc).
    return NextResponse.json({ received: true });
  }

  if (secret) {
    const isValid = verifyMercadoPagoSignature({
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
      dataId,
      secret,
    });
    if (!isValid) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  const payment = await fetchPayment(dataId);
  if (!payment || !payment.external_reference) {
    // Nothing we can reconcile — acknowledge so Mercado Pago stops retrying.
    return NextResponse.json({ received: true });
  }

  const orderId = payment.external_reference;
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, status, order_number, total, customer_snapshot")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ received: true });
  }

  // Idempotency: a payment already marked paid is a no-op, no matter how
  // many times Mercado Pago resends the same notification.
  if (order.status === "paid" || order.status === "processing" || order.status === "shipped" || order.status === "delivered") {
    return NextResponse.json({ received: true });
  }

  if (payment.status !== "approved") {
    await admin
      .from("orders")
      .update({ payment_id: String(payment.id) })
      .eq("id", orderId);
    return NextResponse.json({ received: true });
  }

  const { error: updateError } = await admin
    .from("orders")
    .update({ status: "paid", payment_id: String(payment.id) })
    .eq("id", orderId);

  if (updateError) {
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }

  const { error: stockError } = await admin.rpc("fulfill_order_stock", {
    p_order_id: orderId,
  });

  if (stockError) {
    console.error("[mercadopago webhook] fulfill_order_stock failed", stockError);
  }

  const snapshot = order.customer_snapshot as { name?: string; email?: string } | null;
  const email = snapshot?.email ?? payment.payer?.email;
  if (email) {
    const { data: items } = await admin
      .from("order_items")
      .select("name, color, size, qty, unit_price")
      .eq("order_id", orderId);

    await sendOrderConfirmationEmail({
      to: email,
      customerName: snapshot?.name ?? "cliente",
      orderNumber: order.order_number,
      total: order.total,
      items: (items ?? []).map((i) => ({
        name: i.name,
        color: i.color ?? "",
        size: i.size ?? "",
        qty: i.qty,
        unitPrice: i.unit_price,
      })),
    });
  }

  return NextResponse.json({ received: true });
}
