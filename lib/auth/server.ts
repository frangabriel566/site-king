import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/lib/db/schema";
import { sendPasswordResetEmail } from "@/lib/email";
import { getRequestOrigin } from "@/lib/site-url";
import { hashPassword, verifyPassword } from "./password";

function createAuth(database: D1Database, baseURL: string) {
  return betterAuth({
    appName: "King Store",
    baseURL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(drizzle(database, { schema }), {
      provider: "sqlite",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // No e-mail confirmation for now: the account works right away, as
      // agreed. Flip to true once Resend is configured (plus a
      // sendVerificationEmail) — no schema change needed.
      requireEmailVerification: false,
      autoSignIn: true,
      password: { hash: hashPassword, verify: verifyPassword },
      sendResetPassword: ({ user, url }) =>
        sendPasswordResetEmail({ to: user.email, name: user.name, url }),
      resetPasswordTokenExpiresIn: 60 * 60,
      // Whoever had the old password loses every session it opened.
      revokeSessionsOnPasswordReset: true,
    },
    user: {
      additionalFields: {
        // Never accepted from a sign-up form: only the create-admin script
        // (or a direct UPDATE) makes someone an admin.
        role: { type: "string", required: false, defaultValue: "customer", input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      database: { generateId: "uuid" },
    },
    telemetry: { enabled: false },
    // Lets Server Actions set and clear the session cookie.
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;

// One instance per isolate: building it is not free, and the D1 binding
// object is stable for the isolate's lifetime. Rebuilt only if the binding
// or the base URL ever changes.
let cached: { database: D1Database; baseURL: string; auth: Auth } | null = null;

/**
 * Better Auth for the current request.
 *
 * `BETTER_AUTH_URL` is the canonical origin (the one reset links point
 * to). Without it — local dev and preview — the origin the request came
 * in on is used.
 */
export async function getAuth(): Promise<Auth> {
  const database = getCloudflareContext().env.DB;
  const baseURL = process.env.BETTER_AUTH_URL || (await getRequestOrigin());
  if (!cached || cached.database !== database || cached.baseURL !== baseURL) {
    cached = { database, baseURL, auth: createAuth(database, baseURL) };
  }
  return cached.auth;
}
