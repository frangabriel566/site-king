import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { reviseCartItems } from "@/lib/data/checkout";
import { evaluateCoupon } from "@/lib/data/coupons";
import type { CouponValidationResponse } from "@/lib/coupons/rules";

export const runtime = "nodejs";

const bodySchema = z.object({
  code: z.string().max(60),
  items: z
    .array(
      z.object({
        // z.guid(), not z.uuid() — the seed ids are not RFC-4122 v4.
        variantId: z.guid(),
        qty: z.coerce.number().int().min(1).max(99),
      }),
    )
    .max(50),
});

const noStore = { "Cache-Control": "no-store" };

/**
 * "Does this coupon apply to my bag, and for how much?"
 *
 * Takes the bag's lines, not a subtotal: the subtotal is recomputed here
 * from database prices and today's stock (reviseCartItems — the same
 * numbers the order will use), so a tampered request can't size its own
 * discount. The amount answered is for display; the order recomputes it
 * when it is created, and that is the one recorded.
 *
 * A coupon that doesn't apply is a 200 with `ok: false` and the reason in
 * Portuguese — it is an answer for the shopper, not a failure.
 */
export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "BAD_REQUEST", message: "Pedido inválido." }, { status: 400, headers: noStore });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, reason: "BAD_REQUEST", message: "Não consegui ler a sua sacola. Recarregue a página." },
      { status: 400, headers: noStore },
    );
  }

  const { subtotal } = await reviseCartItems(parsed.data.items);
  const check = await evaluateCoupon(parsed.data.code, subtotal);

  const body: CouponValidationResponse = check.ok
    ? { ok: true, code: check.code, discount: check.discount, freeShipping: check.freeShipping, subtotal }
    : { ok: false, reason: check.reason, message: check.message };
  return NextResponse.json(body, { headers: noStore });
}
