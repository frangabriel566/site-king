import "server-only";
import { and, asc, count, eq, getTableColumns } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Tables } from "@/lib/database.types";
import { requireAdminPage } from "@/lib/auth/guards";
import { safeQuery } from "./safe";

export type Brand = Tables<"brands">;
export type AdminBrandListItem = Brand & { productCount: number };

const { brands, products } = schema;

/** Public: active brands only. */
export async function getActiveBrands(): Promise<Brand[]> {
  return safeQuery(
    () =>
      getDb().query.brands.findMany({
        where: eq(brands.active, true),
        orderBy: asc(brands.position),
      }),
    [],
  );
}

/** Public: an active brand by slug. */
export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  return safeQuery(async () => {
    const row = await getDb().query.brands.findFirst({
      where: and(eq(brands.slug, slug), eq(brands.active, true)),
    });
    return row ?? null;
  }, null);
}

/** Admin listing — all rows (including inactive), with how many products
 *  reference each brand, so the delete confirmation can warn accurately. */
export async function getAllBrandsAdmin(): Promise<AdminBrandListItem[]> {
  await requireAdminPage();
  return getDb()
    .select({ ...getTableColumns(brands), productCount: count(products.id) })
    .from(brands)
    .leftJoin(products, eq(products.brand_id, brands.id))
    .groupBy(brands.id)
    .orderBy(asc(brands.position));
}

export async function getBrandByIdAdmin(id: string): Promise<Brand | null> {
  await requireAdminPage();
  const row = await getDb().query.brands.findFirst({ where: eq(brands.id, id) });
  return row ?? null;
}
