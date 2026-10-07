import "server-only";

/**
 * Wraps a storefront read so a transient database error degrades to a
 * safe fallback instead of crashing the page render — "o site nunca pode
 * aparecer vazio" by accident of one failed query.
 */
export async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error("[safeQuery]", error);
    return fallback;
  }
}
