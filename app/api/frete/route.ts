import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/public";
import { getSiteSettings } from "@/lib/data/settings";
import {
  calculateShipping,
  MelhorEnvioError,
  MelhorEnvioNotConfiguredError,
} from "@/lib/shipping/melhor-envio";
import {
  assertPackageSpecs,
  isValidCep,
  MissingPackageSpecError,
  normalizeCep,
  toQuoteItems,
  type PackageLine,
} from "@/lib/shipping/package";

export const runtime = "nodejs";

const bodySchema = z.object({
  cep: z.string().trim().min(8).max(9),
  items: z
    .array(
      z.object({
        productId: z.guid(),
        quantity: z.coerce.number().int().min(1).max(99),
      }),
    )
    .min(1, "Carrinho vazio")
    .max(50),
});

/**
 * Quotes freight for a bag against a CEP.
 *
 * Public on purpose — it is the shopper's own bag, and it reveals
 * nothing they cannot already see on the product pages. What it does
 * *not* do is trust the client's prices or weights: only product ids and
 * quantities come in, and every number the carrier is given is read back
 * from the database here. A tampered body can change what is being
 * quoted; it cannot change what a parcel weighs or what it insures for.
 */
export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const cep = normalizeCep(parsed.data.cep);
  if (!isValidCep(cep)) {
    return NextResponse.json({ error: "CEP inválido." }, { status: 400 });
  }

  const settings = await getSiteSettings();
  const originCep = normalizeCep(settings.origin_cep ?? "");
  if (!isValidCep(originCep)) {
    return NextResponse.json(
      { error: "A loja ainda não configurou o CEP de origem." },
      { status: 503 },
    );
  }

  // Quantities are summed per product: the same product in two colours is
  // two bag lines but one parcel line, and its weight counts twice.
  const quantities = new Map<string, number>();
  for (const item of parsed.data.items) {
    quantities.set(
      item.productId,
      (quantities.get(item.productId) ?? 0) + item.quantity,
    );
  }

  const supabase = createPublicClient();
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, price, weight_grams, length_cm, width_cm, height_cm")
    .in("id", [...quantities.keys()])
    .eq("status", "active");

  if (error) {
    return NextResponse.json(
      { error: "Não foi possível consultar os produtos." },
      { status: 502 },
    );
  }
  if (!products || products.length === 0) {
    return NextResponse.json({ error: "Produtos não encontrados." }, { status: 404 });
  }

  const lines: PackageLine[] = products.map((product) => ({
    product,
    quantity: quantities.get(product.id) ?? 1,
    unitPrice: Number(product.price),
  }));

  try {
    assertPackageSpecs(lines);
    const quotes = await calculateShipping({
      fromPostalCode: originCep,
      toPostalCode: cep,
      products: toQuoteItems(lines),
    });

    if (quotes.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma transportadora atende esse CEP." },
        { status: 404 },
      );
    }

    return NextResponse.json({ quotes });
  } catch (cause) {
    if (cause instanceof MissingPackageSpecError) {
      // The shopper cannot act on which product is missing a weight, and
      // naming it would leak catalogue state. The operator gets the
      // detail in the logs instead.
      console.error("[frete] produto sem peso/medidas:", cause.productNames);
      return NextResponse.json(
        { error: "Frete indisponível para um dos itens. Fale com a loja." },
        { status: 409 },
      );
    }
    if (cause instanceof MelhorEnvioNotConfiguredError) {
      console.error("[frete]", cause.message);
      return NextResponse.json(
        { error: "Cálculo de frete temporariamente indisponível." },
        { status: 503 },
      );
    }
    if (cause instanceof MelhorEnvioError) {
      console.error("[frete] Melhor Envio:", cause.message, cause.detail);
      return NextResponse.json(
        { error: "Não foi possível calcular o frete agora." },
        { status: 502 },
      );
    }
    throw cause;
  }
}
