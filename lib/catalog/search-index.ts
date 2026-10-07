import "server-only";
import { eq, inArray, or } from "drizzle-orm";
import { getDb, schema, type Db } from "@/lib/db";
import { runBatch } from "@/lib/db/batch";
import { buildProductSearchText } from "@/lib/search-text";

const { products, brands, categories } = schema;

/** `products.search_text` for a product about to be saved: its own name
 * plus the current names of its brand and category. */
export async function searchTextFor(
  db: Db,
  product: { name: string; brand_id?: string | null; category_id?: string | null },
): Promise<string> {
  const [brand, category] = await Promise.all([
    product.brand_id
      ? db.query.brands.findFirst({ columns: { name: true }, where: eq(brands.id, product.brand_id) })
      : undefined,
    product.category_id
      ? db.query.categories.findFirst({
          columns: { name: true },
          where: eq(categories.id, product.category_id),
        })
      : undefined,
  ]);
  return buildProductSearchText({
    name: product.name,
    brandName: brand?.name,
    categoryName: category?.name,
  });
}

/**
 * Rewrites `search_text` for products whose brand or category changed name
 * (or was deleted) — otherwise searching the new name would miss them.
 * Pass the product ids to refresh, or a brand/category id to refresh every
 * product that points at it.
 */
export async function refreshSearchText(target: {
  productIds?: string[];
  brandId?: string;
  categoryId?: string;
}): Promise<void> {
  // inArray binds one parameter per id, and D1 allows 100 per statement.
  if (target.productIds && target.productIds.length > 90) {
    for (let i = 0; i < target.productIds.length; i += 90) {
      await refreshSearchText({ productIds: target.productIds.slice(i, i + 90) });
    }
    return;
  }

  const db = getDb();
  const conditions = [
    target.productIds?.length ? inArray(products.id, target.productIds) : undefined,
    target.brandId ? eq(products.brand_id, target.brandId) : undefined,
    target.categoryId ? eq(products.category_id, target.categoryId) : undefined,
  ].filter((c) => c !== undefined);
  if (conditions.length === 0) return;

  const rows = await db.query.products.findMany({
    columns: { id: true, name: true, search_text: true },
    where: or(...conditions),
    with: {
      brand: { columns: { name: true } },
      category: { columns: { name: true } },
    },
  });

  const changed = rows
    .map((row) => ({
      id: row.id,
      before: row.search_text,
      after: buildProductSearchText({
        name: row.name,
        brandName: row.brand?.name,
        categoryName: row.category?.name,
      }),
    }))
    .filter((row) => row.before !== row.after);

  await runBatch(
    db,
    changed.map((row) =>
      db.update(products).set({ search_text: row.after }).where(eq(products.id, row.id)),
    ),
  );
}

/** Ids of the products pointing at a brand or category — read before
 * deleting it, since the delete nulls the link (ON DELETE SET NULL). */
export async function productIdsLinkedTo(target: {
  brandId?: string;
  categoryId?: string;
}): Promise<string[]> {
  const where = target.brandId
    ? eq(products.brand_id, target.brandId)
    : target.categoryId
      ? eq(products.category_id, target.categoryId)
      : undefined;
  if (!where) return [];
  const rows = await getDb().select({ id: products.id }).from(products).where(where);
  return rows.map((r) => r.id);
}
