import "server-only";
import { cache } from "react";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Tables } from "@/lib/database.types";
import { requireAdminPage } from "@/lib/auth/guards";
import { safeQuery } from "./safe";

export type Category = Tables<"categories">;

const { categories, products, product_images } = schema;

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

/** Enough of a category to link to it. */
export type CategoryLink = Pick<Category, "id" | "name" | "slug">;

/** What the storefront's menus and circles need — never the size guide,
 * which only the product page reads and which would otherwise ride along
 * in the HTML of every page (the header gets this list). */
export type CategoryShowcase = CategoryLink & {
  image: { url: string; alt: string | null } | null;
};

/**
 * Each category's photo: its own (Admin → Categorias) when it has one,
 * else the first image of its first active product (lowest `position`,
 * newest on a tie) that has a photo. A category with neither gets
 * `image: null`, and the caller falls back to a plain monogram tile.
 *
 * The pick happens in D1 (one row per category comes back), not in the
 * Worker: the shop layout asks for this on every page for the mobile
 * menu, and loading every product's images to keep one per category
 * would be CPU spent on each request. Cached per request so the home,
 * which shows the same tiles, shares the result.
 */
export const getCategoriesWithImages = cache(async (): Promise<CategoryShowcase[]> => {
  return safeQuery(async () => {
    const db = getDb();
    const ranked = db
      .select({
        category_id: products.category_id,
        url: product_images.url,
        alt: product_images.alt,
        rank: sql<number>`row_number() over (
          partition by ${products.category_id}
          order by ${products.position}, ${products.created_at} desc, ${product_images.position}
        )`.as("rank"),
      })
      .from(products)
      .innerJoin(product_images, eq(product_images.product_id, products.id))
      .where(eq(products.status, "active"))
      .as("ranked");

    const rows = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        own: categories.image_url,
        url: ranked.url,
        alt: ranked.alt,
      })
      .from(categories)
      .leftJoin(ranked, and(eq(ranked.category_id, categories.id), eq(ranked.rank, 1)))
      .where(eq(categories.active, true))
      .orderBy(asc(categories.position));

    return rows.map(({ own, url, alt, ...category }) => ({
      ...category,
      // The category's own photo has no alt of its own: the name next to
      // the circle already says what it is.
      image: own ? { url: own, alt: null } : url ? { url, alt } : null,
    }));
  }, []);
});

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
