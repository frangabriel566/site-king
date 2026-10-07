import "server-only";
import { desc, eq, getTableColumns } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Tables } from "@/lib/database.types";
import { requireAdminPage } from "@/lib/auth/guards";

export type Customer = Tables<"customers"> & { email: string | null };

const { customers, user } = schema;

const CUSTOMER_WITH_EMAIL = { ...getTableColumns(customers), email: user.email };

export async function getAllCustomersAdmin(): Promise<Customer[]> {
  await requireAdminPage();
  return getDb()
    .select(CUSTOMER_WITH_EMAIL)
    .from(customers)
    .leftJoin(user, eq(user.id, customers.id))
    .orderBy(desc(customers.created_at));
}

export async function getCustomerByIdAdmin(id: string): Promise<Customer | null> {
  await requireAdminPage();
  const [row] = await getDb()
    .select(CUSTOMER_WITH_EMAIL)
    .from(customers)
    .leftJoin(user, eq(user.id, customers.id))
    .where(eq(customers.id, id));
  return row ?? null;
}

/** The signed-in user's own customers row (checkout/registration data). */
export async function getCustomerForUser(userId: string): Promise<Tables<"customers"> | null> {
  const row = await getDb().query.customers.findFirst({ where: eq(customers.id, userId) });
  return row ?? null;
}
