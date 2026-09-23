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
  // Deliberately loose: "01310-100", "01310100" and anything a shopper
  // pastes with spaces all get here and are normalized below. Counting
  // digits in the schema would turn a fixable typo into the generic
  // "Dados inválidos.", which tells the shopper nothing.
  cep: z.string().trim().max(20),
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
    // A bad CEP is the shopper's to fix; a bad item list is the app's
    // bug. Saying which one it is costs nothing and saves a support
    // message.
    const badCep = parsed.error.issues.some((issue) => issue.path[0] === "cep");
    return NextResponse.json(
      {
        error: badCep ? "Informe o CEP de entrega." : "Dados inválidos.",
        source: badCep ? "destination_cep" : "request",
      },
      { status: 400 },
    );
  }

  const cep = normalizeCep(parsed.data.cep);
  if (!isValidCep(cep)) {
    return NextResponse.json(
      {
        error: "CEP de entrega inválido. Use os 8 dígitos, ex.: 01310-100.",
        source: "destination_cep",
      },
      { status: 400 },
    );
  }

  const settings = await getSiteSettings();
  const rawOriginCep = (settings.origin_cep ?? "").trim();
  const originCep = normalizeCep(rawOriginCep);
  if (!isValidCep(originCep)) {
    // Never the shopper's fault, so it must not read like it is — and
    // the operator needs to see in the logs whether the field is empty
    // or holding something unusable.
    console.error(
      "[frete] origin_cep inutilizável em site_settings:",
      JSON.stringify(rawOriginCep),
    );
    return NextResponse.json(
      {
        error:
          rawOriginCep === ""
            ? "A loja ainda não configurou o CEP de origem."
            : "O CEP de origem cadastrado pela loja é inválido.",
        source: "origin_cep",
      },
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
      console.error(
        "[frete] Melhor Envio:",
        cause.status ?? "sem status",
        cause.message,
        cause.detail,
      );
      // The upstream message can carry token and account detail, so it
      // stays in the logs. What the shopper gets told is whether waiting
      // helps: a rejected token never fixes itself, a 5xx usually does.
      const isAuth = cause.status === 401 || cause.status === 403;
      return NextResponse.json(
        {
          error: isAuth
            ? "A integração de frete da loja está com um problema de acesso. Fale com a loja."
            : "O Melhor Envio não respondeu ao cálculo. Tente de novo em instantes.",
          source: "melhor_envio",
        },
        { status: 502 },
      );
    }
    throw cause;
  }
}
