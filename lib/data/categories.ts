import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import { safeQuery } from "./safe";

export type Category = Tables<"categories">;

export async function getActiveCategories(): Promise<Category[]> {
  return safeQuery(async () => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("active", true)
      .order("position", { ascending: true });

    return data ?? [];
  }, []);
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
    const supabase = createPublicClient();
    const [{ data: categories }, { data: products }] = await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("active", true)
        .order("position", { ascending: true }),
      supabase
        .from("products")
        .select("category_id, position, product_images(url, alt, position)")
        .eq("status", "active")
        .order("position", { ascending: true }),
    ]);

    const imageByCategory = new Map<string, { url: string; alt: string | null }>();
    for (const product of products ?? []) {
      if (!product.category_id || imageByCategory.has(product.category_id)) continue;
      const [firstImage] = [...product.product_images].sort((a, b) => a.position - b.position);
      if (firstImage) {
        imageByCategory.set(product.category_id, { url: firstImage.url, alt: firstImage.alt });
      }
    }

    return (categories ?? []).map((category) => ({
      ...category,
      image: imageByCategory.get(category.id) ?? null,
    }));
  }, []);
}

/** Admin listing — all rows (including inactive), session-scoped RLS. */
export async function getAllCategoriesAdmin(): Promise<Category[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .order("position", { ascending: true });

  return data ?? [];
}
