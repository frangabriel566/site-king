import { NextResponse, type NextRequest } from "next/server";
import { verifyMercadoPagoSignature } from "@/lib/payments/verify-mercadopago-signature";
import { getMercadoPagoCredentials } from "@/lib/integrations";
import {
  reconcileMercadoPagoPayment,
  type MercadoPagoPayment,
} from "@/lib/payments/reconcile";

export const runtime = "nodejs";

async function fetchPayment(
  paymentId: string,
  accessToken: string,
): Promise<MercadoPagoPayment | null> {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as MercadoPagoPayment;
}

export async function POST(request: NextRequest) {
  // Even with Mercado Pago switched off since: a payment made while it was
  // on still has to land on its order.
  const credentials = await getMercadoPagoCredentials({ requireActive: false });
  const secret = credentials?.webhookSecret ?? null;
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

  // The notification only says "something happened to payment X"; what
  // happened is read from Mercado Pago itself, never from this body.
  const payment = credentials ? await fetchPayment(dataId, credentials.accessToken) : null;
  if (!payment || !payment.external_reference) {
    // Nothing we can reconcile — acknowledge so Mercado Pago stops retrying.
    return NextResponse.json({ received: true });
  }

  try {
    await reconcileMercadoPagoPayment(payment);
  } catch (error) {
    console.error("[mercadopago webhook]", error);
    // 500 so Mercado Pago retries; reconciliation is idempotent.
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
