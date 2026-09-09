import { createPublicClient } from "@/lib/supabase/public";
import type { Tables } from "@/lib/database.types";

export type Review = Tables<"reviews"> & {
  customer: { name: string } | null;
};

/** Public read (no session cookie) — keeps the product page eligible
 * for ISR, same reasoning as the rest of lib/data/products.ts. */
export async function getProductReviews(productId: string): Promise<Review[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("reviews")
    .select("*, customer:customers(name)")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export function summarizeRatings(reviews: Pick<Review, "rating">[]): {
  average: number;
  count: number;
} {
  if (reviews.length === 0) return { average: 0, count: 0 };
  const total = reviews.reduce((sum, r) => sum + r.rating, 0);
  return { average: total / reviews.length, count: reviews.length };
}
