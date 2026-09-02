import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import { safeQuery } from "./safe";

export type Banner = Tables<"banners"> & {
  featured_product: FeaturedBannerProduct | null;
};

export type FeaturedBannerProduct = Pick<
  Tables<"products">,
  "id" | "slug" | "name" | "description" | "price" | "compare_at_price"
>;

export async function getActiveBanners(): Promise<Banner[]> {
  return safeQuery(async () => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("banners")
      .select(
        "*, featured_product:products!banners_featured_product_id_fkey(id, slug, name, description, price, compare_at_price)",
      )
      .eq("active", true)
      .order("position", { ascending: true });

    return (data as Banner[] | null) ?? [];
  }, []);
}

/** Admin listing — all rows regardless of `active`, session-scoped RLS. */
export async function getAllBannersAdmin(): Promise<Banner[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("banners")
    .select(
      "*, featured_product:products!banners_featured_product_id_fkey(id, slug, name, description, price, compare_at_price)",
    )
    .order("position", { ascending: true });

  return (data as Banner[] | null) ?? [];
}

export async function getBannerByIdAdmin(id: string): Promise<Banner | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("banners")
    .select(
      "*, featured_product:products!banners_featured_product_id_fkey(id, slug, name, description, price, compare_at_price)",
    )
    .eq("id", id)
    .maybeSingle();

  return data as Banner | null;
}
