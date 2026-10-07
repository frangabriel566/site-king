import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/db/schema";
import { getAuth } from "./server";

/**
 * Who may read or write what. With Supabase this was Row Level Security
 * inside Postgres; D1 has nothing like it, so every rule now lives here,
 * in server code, and has to be called explicitly:
 *
 * - Storefront reads (lib/data, no guard): only ever query what is public —
 *   `status = 'active'` products and their images/variants, `active`
 *   categories/brands/banners, site settings, reviews. Coupons are never
 *   listed publicly; they are only validated by code (lib/data/coupons.ts).
 * - Anything admin (panel pages, catalog/order/coupon/settings writes,
 *   uploads, labels): `requireAdmin()` in Server Actions and Route
 *   Handlers, `requireAdminPage()` in panel pages and their data loaders.
 * - A customer's own data (customers, addresses, orders, reviews):
 *   `requireUser()` and every query filtered by `user.id` — never by an id
 *   that came from the browser.
 * - Newsletter: anyone can subscribe; only admins can list.
 * - /pedido/[id]: readable by anyone holding the order's random UUID, the
 *   same trust model the confirmation link always had.
 */

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

export class AuthError extends Error {
  constructor(readonly code: "UNAUTHORIZED" | "FORBIDDEN") {
    super(code);
  }
}

/** Kept as its own name: route handlers map it to 401/403. */
export class AdminAuthError extends AuthError {}

/** The signed-in user, or null. Read once per request, from the database
 * (no cookie cache), so a role change or a revoked session counts at once. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  try {
    const auth = await getAuth();
    const result = await auth.api.getSession({ headers: await headers() });
    if (!result) return null;
    const { id, email, name } = result.user;
    const role = (result.user as { role?: string }).role === "admin" ? "admin" : "customer";
    return { id, email, name, role };
  } catch (error) {
    // A broken auth setup must not take the storefront down with it:
    // treat it as signed out (the old Supabase middleware failed open too).
    console.error("[getCurrentUser]", error);
    return null;
  }
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("UNAUTHORIZED");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AdminAuthError("UNAUTHORIZED");
  if (user.role !== "admin") throw new AdminAuthError("FORBIDDEN");
  return user;
}

/** For panel pages and the loaders they call: bounces to the login screen
 * instead of throwing into an error page. `next` is where to come back to. */
export async function requireAdminPage(next?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (user?.role === "admin") return user;
  const target = next?.startsWith("/admin") ? next : "/admin";
  redirect(`/admin/login?next=${encodeURIComponent(target)}`);
}
