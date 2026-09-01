import "server-only";

/**
 * Wraps a Supabase read so a transient outage (or, at build time, a
 * misconfigured/unreachable project) degrades to a safe fallback
 * instead of crashing the page render or the static build. The
 * storefront must never hard-fail just because one read hiccuped —
 * "o site nunca pode aparecer vazio".
 */
export async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error("[safeQuery]", error);
    return fallback;
  }
}
