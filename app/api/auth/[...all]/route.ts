import { getAuth } from "@/lib/auth/server";

/**
 * Better Auth's HTTP endpoints. The forms in this app talk to it through
 * Server Actions (auth.api.*), so in practice this route serves the link in
 * the password-reset e-mail: /api/auth/reset-password/<token> checks the
 * token and redirects to /redefinir-senha?token=… (or ?error=INVALID_TOKEN).
 */
async function handler(request: Request) {
  const auth = await getAuth();
  return auth.handler(request);
}

export { handler as GET, handler as POST };
