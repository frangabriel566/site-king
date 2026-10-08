import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { reviseCartItems } from "@/lib/data/checkout";
import { evaluateCoupon, evaluateCouponOffer } from "@/lib/data/coupons";
import type { CouponValidationResponse } from "@/lib/coupons/rules";
import { isRateLimited, rateLimitKey, recordFailure } from "@/lib/rate-limit";

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

/** Failed checks per client per minute before the route stops answering. */
const MAX_FAILURES_PER_MINUTE = 10;

/** Answers that are normal states of a good coupon, not a wrong guess. */
const NOT_A_FAILURE = new Set(["BELOW_MINIMUM", "EMPTY_CART", "EMPTY_CODE"]);

/**
 * "Does this coupon apply to my bag, and for how much?" — open to visitors,
 * no login.
 *
 * Takes the bag's lines, not a subtotal: the subtotal is recomputed here
 * from database prices and today's stock (reviseCartItems — the same
 * numbers the order will use), so a tampered request can't size its own
 * discount. The amount answered is for display; the order recomputes it
 * when it is created, and that is the one recorded.
 *
 * With no lines (the product page, a ?cupom= link) it checks the coupon
 * alone and answers what it gives ("-10%"), the minimum left for the bag.
 *
 * A coupon that doesn't apply is a 200 with `ok: false` and the reason in
 * Portuguese — it is an answer for the shopper, not a failure. Wrong codes
 * are counted per client: past 10 in a minute the route answers 429 until
 * the minute turns (lib/rate-limit.ts), so codes can't be guessed.
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

  const key = await rateLimitKey(request, "coupon");
  if (await isRateLimited(key, MAX_FAILURES_PER_MINUTE)) {
    const body: CouponValidationResponse = {
      ok: false,
      reason: "RATE_LIMITED",
      message: "Muitas tentativas de cupom. Aguarde um minuto e tente de novo.",
    };
    return NextResponse.json(body, { status: 429, headers: noStore });
  }

  let body: CouponValidationResponse;
  if (parsed.data.items.length === 0) {
    const check = await evaluateCouponOffer(parsed.data.code);
    body = check.ok
      ? {
          ok: true,
          code: check.offer.code,
          discount: 0,
          freeShipping: check.offer.freeShipping,
          subtotal: 0,
          offer: check.offer,
        }
      : { ok: false, reason: check.reason, message: check.message };
  } else {
    const { subtotal } = await reviseCartItems(parsed.data.items);
    const check = await evaluateCoupon(parsed.data.code, subtotal);
    body = check.ok
      ? {
          ok: true,
          code: check.code,
          discount: check.discount,
          freeShipping: check.freeShipping,
          subtotal,
          offer: check.offer,
        }
      : {
          ok: false,
          reason: check.reason,
          message: check.message,
          offer: check.offer,
          missing: check.missing,
        };
  }

  if (!body.ok && !NOT_A_FAILURE.has(body.reason)) await recordFailure(key);
  return NextResponse.json(body, { headers: noStore });
}
