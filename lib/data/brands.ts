import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import { safeQuery } from "./safe";

export type Brand = Tables<"brands">;
export type AdminBrandListItem = Brand & { productCount: number };

export async function getActiveBrands(): Promise<Brand[]> {
  return safeQuery(async () => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("brands")
      .select("*")
      .eq("active", true)
      .order("position", { ascending: true });

    return data ?? [];
  }, []);
}

export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  return safeQuery(async () => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("brands")
      .select("*")
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle();

    return data ?? null;
  }, null);
}

/** Admin listing — all rows (including inactive), with how many products
 *  reference each brand, so the delete confirmation can warn accurately. */
export async function getAllBrandsAdmin(): Promise<AdminBrandListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("*, products(count)")
    .order("position", { ascending: true });

  return (data ?? []).map((row) => {
    const { products, ...brand } = row as Brand & { products: { count: number }[] };
    return { ...brand, productCount: products[0]?.count ?? 0 };
  });
}
