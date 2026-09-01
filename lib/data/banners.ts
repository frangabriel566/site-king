import { createPublicClient } from "@/lib/supabase/public";
import type { Tables } from "@/lib/database.types";
import { safeQuery } from "./safe";

export type Banner = Tables<"banners"> & {
  featured_product: FeaturedBannerProduct | null;
};

export type FeaturedBannerProduct = Pick<
  Tables<"products">,
  "id" | "slug" | "name" | "description" | "price" | "compare_at_price"
>;

export async function getActiveBanner(): Promise<Banner | null> {
  return safeQuery(async () => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("banners")
      .select(
        "*, featured_product:products!banners_featured_product_id_fkey(id, slug, name, description, price, compare_at_price)",
      )
      .eq("active", true)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    return data as Banner | null;
  }, null);
}
