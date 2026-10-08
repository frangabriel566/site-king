import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

const { rate_limits } = schema;

const WINDOW_MS = 60_000;
/** Rows older than this are swept on the next failure. */
const KEEP_MS = 10 * WINDOW_MS;

/**
 * Failed attempts per client per minute, in D1 (table rate_limits).
 *
 * Only failures are counted — a valid coupon re-checked every time the bag
 * changes must never lock the shopper out; guessing codes is what this
 * stops. Checking costs one read; only a failure writes. Cloudflare's own
 * rate-limit binding counts every call it is asked about and cannot be
 * peeked at, so it can't tell the two apart.
 *
 * The key is a hash of scope + IP: the raw address is never stored, and a
 * row lives about ten minutes.
 */
export async function rateLimitKey(request: Request, scope: string): Promise<string> {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${scope}:${ip}`));
  return Array.from(new Uint8Array(digest).subarray(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

function currentWindow(now: number): number {
  return now - (now % WINDOW_MS);
}

/** Whether `key` already failed `max` times this minute. */
export async function isRateLimited(key: string, max: number, now = Date.now()): Promise<boolean> {
  const [row] = await getDb()
    .select({ count: rate_limits.count })
    .from(rate_limits)
    .where(and(eq(rate_limits.key, key), eq(rate_limits.window_start, currentWindow(now))));
  return (row?.count ?? 0) >= max;
}

export async function recordFailure(key: string, now = Date.now()): Promise<void> {
  const db = getDb();
  await db.batch([
    db
      .insert(rate_limits)
      .values({ key, window_start: currentWindow(now), count: 1 })
      .onConflictDoUpdate({
        target: [rate_limits.key, rate_limits.window_start],
        set: { count: sql`${rate_limits.count} + 1` },
      }),
    db.delete(rate_limits).where(lt(rate_limits.window_start, now - KEEP_MS)),
  ]);
}
