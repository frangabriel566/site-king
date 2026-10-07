import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Tables } from "@/lib/database.types";
import { getCurrentUser } from "@/lib/auth/guards";

export type Address = Tables<"addresses">;

/** The signed-in customer's own addresses, default first. */
export async function getMyAddresses(): Promise<Address[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  return getDb().query.addresses.findMany({
    where: eq(schema.addresses.customer_id, user.id),
    orderBy: desc(schema.addresses.is_default),
  });
}
