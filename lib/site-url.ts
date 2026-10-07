import "server-only";
import { headers } from "next/headers";

/**
 * The origin the current request actually arrived on.
 *
 * Used for links that leave the app and have to come back — the
 * password-reset link (when BETTER_AUTH_URL is not set) and the product
 * links in a WhatsApp order message. `NEXT_PUBLIC_SITE_URL` is a single fixed
 * value baked in at build time, so it is wrong on every Vercel preview
 * deployment and stays wrong locally until someone remembers to change
 * it; reading the request's own host instead means the link always
 * points at whichever deployment sent it. The env var is the fallback
 * for calls made outside a request (a script, a cron job).
 */
export async function getRequestOrigin(): Promise<string> {
  try {
    const headerList = await headers();
    // Vercel (and most proxies) put the browser-facing host here; `host`
    // alone is the internal one behind a proxy.
    const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
    if (host) {
      const proto =
        headerList.get("x-forwarded-proto") ??
        (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // Called outside a request context.
  }

  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}
