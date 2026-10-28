import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getSiteSettings } from "@/lib/data/settings";
import {
  calculateShipping,
  MelhorEnvioError,
  MelhorEnvioNotConfiguredError,
  type ShippingQuote,
} from "@/lib/shipping/melhor-envio";
import {
  assertPackageSpecs,
  isValidCep,
  MissingPackageSpecError,
  normalizeCep,
  toQuoteItems,
  type PackageLine,
} from "@/lib/shipping/package";

export type FreightQuoteResult =
  | { ok: true; cep: string; quotes: ShippingQuote[] }
  | {
      ok: false;
      /** For the shopper — never carries token or account detail. */
      error: string;
      /** HTTP status the CEP box answers with. */
      status: number;
      source?: "destination_cep" | "origin_cep" | "melhor_envio";
    };

/**
 * The freight quote, written once (Etapa 3): the CEP box on the product
 * page and in the bag, the checkout's Frete step and the server pricing
 * the order all ask here, so the shopper never sees one price and pays
 * another.
 *
 * Only product ids and quantities come in. Every number the carrier is
 * given — weight, size, the value insured — is read back from the
 * database here, so a tampered request can change what is quoted but not
 * what a parcel weighs.
 */
export async function quoteFreight(
  rawCep: string,
  items: { productId: string; quantity: number }[],
): Promise<FreightQuoteResult> {
  const cep = normalizeCep(rawCep);
  if (!isValidCep(cep)) {
    return {
      ok: false,
      status: 400,
      source: "destination_cep",
      error: "CEP de entrega inválido. Use os 8 dígitos, ex.: 01310-100.",
    };
  }

  const settings = await getSiteSettings();
  const rawOriginCep = (settings.origin_cep ?? "").trim();
  const originCep = normalizeCep(rawOriginCep);
  if (!isValidCep(originCep)) {
    // Never the shopper's fault, so it must not read like it is — and the
    // operator needs to see in the logs whether the field is empty or
    // holding something unusable.
    console.error("[frete] origin_cep inutilizável em site_settings:", JSON.stringify(rawOriginCep));
    return {
      ok: false,
      status: 503,
      source: "origin_cep",
      error:
        rawOriginCep === ""
          ? "A loja ainda não configurou o CEP de origem."
          : "O CEP de origem cadastrado pela loja é inválido.",
    };
  }

  // Quantities are summed per product: the same product in two colours is
  // two bag lines but one parcel line, and its weight counts twice.
  const quantities = new Map<string, number>();
  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }
  if (quantities.size === 0) {
    return { ok: false, status: 400, error: "Carrinho vazio." };
  }

  let products;
  try {
    const { products: table } = schema;
    products = await getDb()
      .select({
        id: table.id,
        name: table.name,
        price: table.price,
        weight_grams: table.weight_grams,
        length_cm: table.length_cm,
        width_cm: table.width_cm,
        height_cm: table.height_cm,
      })
      .from(table)
      // The callers cap the list at 50 lines, well under D1's 100-parameter
      // limit.
      .where(and(inArray(table.id, [...quantities.keys()]), eq(table.status, "active")));
  } catch (error) {
    console.error("[frete] consulta de produtos", error);
    return { ok: false, status: 502, error: "Não foi possível consultar os produtos." };
  }

  if (products.length === 0) {
    return { ok: false, status: 404, error: "Produtos não encontrados." };
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
      return { ok: false, status: 404, error: "Nenhuma transportadora atende esse CEP." };
    }
    return { ok: true, cep, quotes };
  } catch (cause) {
    if (cause instanceof MissingPackageSpecError) {
      // The shopper cannot act on which product is missing a weight, and
      // naming it would leak catalogue state. The operator gets the detail
      // in the logs instead.
      console.error("[frete] produto sem peso/medidas:", cause.productNames);
      return {
        ok: false,
        status: 409,
        error: "Frete indisponível para um dos itens. Fale com a loja.",
      };
    }
    if (cause instanceof MelhorEnvioNotConfiguredError) {
      console.error("[frete]", cause.message);
      return { ok: false, status: 503, error: "Cálculo de frete temporariamente indisponível." };
    }
    if (cause instanceof MelhorEnvioError) {
      console.error("[frete] Melhor Envio:", cause.status ?? "sem status", cause.message, cause.detail);
      // The upstream message can carry token and account detail, so it
      // stays in the logs. What the shopper gets told is whether waiting
      // helps: a rejected token never fixes itself, a 5xx usually does.
      const isAuth = cause.status === 401 || cause.status === 403;
      return {
        ok: false,
        status: 502,
        source: "melhor_envio",
        error: isAuth
          ? "A integração de frete da loja está com um problema de acesso. Fale com a loja."
          : "O Melhor Envio não respondeu ao cálculo. Tente de novo em instantes.",
      };
    }
    throw cause;
  }
}
