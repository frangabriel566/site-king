import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Tables } from "@/lib/database.types";
import { requireAdminPage } from "@/lib/auth/guards";
import { safeQuery } from "./safe";

export type Category = Tables<"categories">;

const { categories, products } = schema;

/** Public: active categories only. */
export async function getActiveCategories(): Promise<Category[]> {
  return safeQuery(
    () =>
      getDb().query.categories.findMany({
        where: eq(categories.active, true),
        orderBy: asc(categories.position),
      }),
    [],
  );
}

export type CategoryShowcase = Category & {
  image: { url: string; alt: string | null } | null;
};

/**
 * Categories don't have their own photo field in the schema — instead of
 * inventing one, each tile borrows the first image of its category's
 * first active product (lowest `position`). A category with no active
 * product yet just gets `image: null`, and the caller falls back to a
 * plain monogram tile.
 */
export async function getCategoriesWithImages(): Promise<CategoryShowcase[]> {
  return safeQuery(async () => {
    const db = getDb();
    const [activeCategories, activeProducts] = await db.batch([
      db.query.categories.findMany({
        where: eq(categories.active, true),
        orderBy: asc(categories.position),
      }),
      db.query.products.findMany({
        columns: { category_id: true, position: true },
        where: eq(products.status, "active"),
        orderBy: asc(products.position),
        with: { product_images: { columns: { url: true, alt: true, position: true } } },
      }),
    ]);

    const imageByCategory = new Map<string, { url: string; alt: string | null }>();
    for (const product of activeProducts) {
      if (!product.category_id || imageByCategory.has(product.category_id)) continue;
      const [firstImage] = [...product.product_images].sort((a, b) => a.position - b.position);
      if (firstImage) {
        imageByCategory.set(product.category_id, { url: firstImage.url, alt: firstImage.alt });
      }
    }

    return activeCategories.map((category) => ({
      ...category,
      image: imageByCategory.get(category.id) ?? null,
    }));
  }, []);
}

/** Admin listing — all rows, including inactive. */
export async function getAllCategoriesAdmin(): Promise<Category[]> {
  await requireAdminPage();
  return getDb().query.categories.findMany({ orderBy: asc(categories.position) });
}

export async function getCategoryByIdAdmin(id: string): Promise<Category | null> {
  await requireAdminPage();
  const row = await getDb().query.categories.findFirst({ where: eq(categories.id, id) });
  return row ?? null;
}
