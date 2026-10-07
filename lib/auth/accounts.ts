import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { UserRole } from "@/lib/db/schema";
import { verifyPassword } from "./password";

/**
 * Direct reads of Better Auth's tables, for the two places that need to
 * check a password without opening or touching a session. Server-only on
 * purpose — never re-export these from a "use server" file, where they
 * would become public endpoints.
 */

export async function findUserByEmail(
  email: string,
): Promise<{ id: string; email: string; role: UserRole } | null> {
  const [row] = await getDb()
    .select({ id: schema.user.id, email: schema.user.email, role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.email, email.trim().toLowerCase()));
  return row ?? null;
}

/** True when `password` is this user's current e-mail/password credential. */
export async function passwordMatches(userId: string, password: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ hash: schema.account.password })
    .from(schema.account)
    .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, "credential")));
  if (!row?.hash) return false;
  return verifyPassword({ hash: row.hash, password });
}
