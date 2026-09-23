import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, AdminAuthError } from "@/lib/actions/require-admin";
import { getSiteSettings } from "@/lib/data/settings";
import {
  addShipmentToCart,
  calculateShipping,
  checkoutShipments,
  generateShipments,
  getShipmentInfo,
  printShipments,
  MelhorEnvioError,
  MelhorEnvioNotConfiguredError,
  type ShipmentParty,
} from "@/lib/shipping/melhor-envio";
import {
  assertPackageSpecs,
  insuranceValue,
  isValidCep,
  MissingPackageSpecError,
  normalizeCep,
  toQuoteItems,
  toSingleVolume,
  type PackageLine,
} from "@/lib/shipping/package";

export const runtime = "nodejs";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("quote"), orderId: z.guid() }),
  z.object({
    action: z.literal("purchase"),
    orderId: z.guid(),
    serviceId: z.coerce.number().int().positive(),
    // Correios refuses a label without a recipient document, and the
    // checkout never asks for one. Until it does, the operator supplies
    // it here; see the note in the admin panel.
    document: z.string().trim().max(20).optional().or(z.literal("")),
  }),
]);

type Snapshot = { name?: string; email?: string; phone?: string } | null;
type Address = {
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  cep?: string;
} | null;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Buys and prints a Melhor Envio label for an order.
 *
 * Split in two on purpose. `quote` reads and costs nothing, so the
 * operator can see the carriers and prices for the address actually on
 * the order before committing. `purchase` is the irreversible one: it
 * pays for the label out of the account balance, asks the carrier to
 * issue it, and stores the result. Anything that spends money is behind
 * that second, explicitly chosen call — never a side effect of opening
 * the page or of picking a service.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (cause) {
    if (cause instanceof AdminAuthError) {
      return fail("Acesso negado.", cause.message === "UNAUTHORIZED" ? 401 : 403);
    }
    throw cause;
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail("Corpo inválido.", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fail("Dados inválidos.", 400);
  const body = parsed.data;

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", body.orderId)
    .maybeSingle();

  if (!order) return fail("Pedido não encontrado.", 404);

  const address = order.shipping_address as Address;
  const snapshot = order.customer_snapshot as Snapshot;
  const toCep = normalizeCep(address?.cep ?? "");
  if (!isValidCep(toCep)) return fail("O pedido não tem um CEP de entrega válido.", 422);

  const settings = await getSiteSettings();
  const fromCep = normalizeCep(settings.origin_cep ?? "");
  if (!isValidCep(fromCep)) {
    return fail("Configure o endereço de origem em Configurações antes de gerar etiquetas.", 409);
  }

  // Weights come from the products table, not from the order, so a spec
  // corrected after the sale is the one the label is bought against.
  const items = (order.order_items ?? []) as {
    product_id: string | null;
    name: string;
    unit_price: number;
    qty: number;
  }[];
  const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))] as string[];
  if (productIds.length === 0) return fail("O pedido não tem itens com produto vinculado.", 422);

  const { data: products } = await admin
    .from("products")
    .select("id, name, weight_grams, length_cm, width_cm, height_cm")
    .in("id", productIds);

  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  const lines: PackageLine[] = [];
  for (const item of items) {
    const product = item.product_id ? byId.get(item.product_id) : undefined;
    if (!product) continue;
    lines.push({ product, quantity: item.qty, unitPrice: Number(item.unit_price) });
  }
  if (lines.length === 0) return fail("Não foi possível montar o pacote do pedido.", 422);

  try {
    assertPackageSpecs(lines);

    if (body.action === "quote") {
      const quotes = await calculateShipping({
        fromPostalCode: fromCep,
        toPostalCode: toCep,
        products: toQuoteItems(lines),
      });
      return NextResponse.json({ quotes });
    }

    // ---- purchase ------------------------------------------------
    // Already bought: hand back what exists rather than buying a second
    // label for the same parcel. A double click, a retried request or a
    // second operator all land here.
    if (order.melhorenvio_order_id) {
      return NextResponse.json({
        alreadyIssued: true,
        melhorenvioOrderId: order.melhorenvio_order_id,
        labelUrl: order.label_url,
        trackingCode: order.tracking_code,
      });
    }

    if (!settings.origin_document) {
      return fail("Cadastre o CPF/CNPJ da loja em Configurações antes de gerar etiquetas.", 409);
    }

    const from: ShipmentParty = {
      name: settings.store_name,
      phone: settings.whatsapp ?? undefined,
      email: settings.email ?? undefined,
      document: settings.origin_document,
      address: settings.origin_street ?? "",
      complement: settings.origin_complement ?? undefined,
      number: settings.origin_number ?? "",
      district: settings.origin_district ?? "",
      city: settings.origin_city ?? "",
      state_abbr: settings.origin_state ?? "",
      country_id: "BR",
      postal_code: fromCep,
    };

    const to: ShipmentParty = {
      name: snapshot?.name ?? "Cliente",
      phone: snapshot?.phone ?? undefined,
      email: snapshot?.email ?? undefined,
      document: body.document ? body.document.replace(/\D/g, "") : undefined,
      address: address?.street ?? "",
      complement: address?.complement ?? undefined,
      number: address?.number ?? "",
      district: address?.district ?? "",
      city: address?.city ?? "",
      state_abbr: address?.state ?? "",
      country_id: "BR",
      postal_code: toCep,
    };

    const cartItem = await addShipmentToCart({
      service: body.serviceId,
      from,
      to,
      products: lines.map((line) => ({
        name: line.product.name,
        quantity: line.quantity,
        unitary_value: line.unitPrice,
      })),
      volumes: [toSingleVolume(lines)],
      insuranceValue: insuranceValue(lines),
    });

    if (!cartItem?.id) return fail("O Melhor Envio não devolveu a etiqueta.", 502);

    // Claim the id before spending anything. If checkout or generation
    // fails below, the order still points at the cart item, so the next
    // attempt short-circuits above instead of creating a second one and
    // the operator can finish it in the Melhor Envio panel.
    await admin
      .from("orders")
      .update({
        melhorenvio_order_id: cartItem.id,
        shipping_service: String(body.serviceId),
      })
      .eq("id", order.id);

    await checkoutShipments([cartItem.id]);
    await generateShipments([cartItem.id]);

    const printed = await printShipments([cartItem.id]);
    const info = await getShipmentInfo(cartItem.id).catch(() => null);
    const trackingCode = info?.tracking ?? info?.self_tracking ?? null;

    await admin
      .from("orders")
      .update({
        label_url: printed?.url ?? null,
        ...(trackingCode ? { tracking_code: trackingCode } : {}),
      })
      .eq("id", order.id);

    return NextResponse.json({
      melhorenvioOrderId: cartItem.id,
      labelUrl: printed?.url ?? null,
      trackingCode,
    });
  } catch (cause) {
    if (cause instanceof MissingPackageSpecError) {
      return fail(cause.message, 409);
    }
    if (cause instanceof MelhorEnvioNotConfiguredError) {
      return fail(cause.message, 503);
    }
    if (cause instanceof MelhorEnvioError) {
      console.error("[etiqueta] Melhor Envio:", cause.message, cause.detail);
      return fail(cause.message, 502);
    }
    throw cause;
  }
}
