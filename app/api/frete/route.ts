import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { quoteFreight } from "@/lib/shipping/quote";

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
 * Quotes freight for a bag against a CEP — the "Calcular frete e prazo"
 * box. Public on purpose: it is the shopper's own bag, and it reveals
 * nothing they cannot already see on the product pages. The quote itself
 * (and why nothing the client sends is trusted for weight or value) lives
 * in lib/shipping/quote.ts, shared with the checkout.
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

  const result = await quoteFreight(parsed.data.cep, parsed.data.items);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.source ? { source: result.source } : {}) },
      { status: result.status },
    );
  }
  return NextResponse.json({ quotes: result.quotes });
}
