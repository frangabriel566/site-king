import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/site-url";

/**
 * Where the e-mail confirmation link lands.
 *
 * Supabase only mails the link — turning it into a session is the app's
 * job, and without this route the link had nowhere to go but the bare
 * site URL, which left the shopper looking at a logged-out page with no
 * sign anything had happened.
 *
 * Two shapes arrive here and both are handled:
 *
 * - `?token_hash=…&type=…` — what the mail template sends when it is
 *   written against `{{ .TokenHash }}`. This is the one worth using: the
 *   hash is self-contained, so confirming on a phone works even though
 *   the account was created on a desktop.
 * - `?code=…` — the PKCE exchange, which is what the stock
 *   `{{ .ConfirmationURL }}` ends up producing. It only completes on the
 *   same browser that signed up, because the verifier lives in a cookie
 *   set there; on any other device it fails, which is exactly why the
 *   template above is the better one to send.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = await getRequestOrigin();

  // Only ever bounce to a path on this site: `next` arrives from a link
  // in an e-mail, so treating it as a full URL would turn the
  // confirmation into an open redirect.
  const requested = url.searchParams.get("next") ?? "/conta";
  const next =
    requested.startsWith("/") && !requested.startsWith("//") ? requested : "/conta";

  const supabase = await createClient();

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
    return NextResponse.redirect(new URL("/conta?erro=confirmacao", origin));
  }

  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL("/conta?erro=confirmacao", origin));
}
