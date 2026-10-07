import { NextResponse, type NextRequest } from "next/server";

// Better Auth's session cookie, plain and with the prefix it uses on https.
const SESSION_COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

/**
 * First line of the /admin gate: no session cookie at all means no chance
 * of being an admin, so bounce to the login screen without rendering
 * anything.
 *
 * Deliberately only a cookie check. Validating the session and the role
 * needs the database and Better Auth, and pulling those into the
 * middleware bundle would grow the Worker for every request. The real
 * check — session valid, role = admin — runs in the panel layout and in
 * every admin Server Action and Route Handler (lib/auth/guards.ts).
 *
 * Also forwards the path as `x-pathname`, so the panel layout knows where
 * to send the operator back to after logging in.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname !== "/admin/login") {
    const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", `${pathname}${search}`);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Only the panel: the storefront never pays for a middleware run.
  matcher: ["/admin", "/admin/:path*"],
};
