import { createPublicClient } from "@/lib/supabase/public";
import type { Tables } from "@/lib/database.types";

export type Review = Tables<"reviews"> & {
  customer: { name: string } | null;
};

/** Public read (no session cookie) — keeps the product page eligible
 * for ISR, same reasoning as the rest of lib/data/products.ts.
 *
 * customer_id references auth.users (any signed-in visitor can review,
 * not just shoppers who completed the customer signup form), so there's
 * no FK for PostgREST to embed a `customers` join on — look the name up
 * separately instead and treat a miss (e.g. an admin account) as
 * anonymous rather than an error. */
export async function getProductReviews(productId: string): Promise<Review[]> {
  const supabase = createPublicClient();
  const { data: reviews } = await supabase
    .from("reviews")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (!reviews || reviews.length === 0) return [];

  const customerIds = [...new Set(reviews.map((r) => r.customer_id))];
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .in("id", customerIds);

  const nameById = new Map((customers ?? []).map((c) => [c.id, c.name]));
  return reviews.map((r) => ({
    ...r,
    customer: nameById.has(r.customer_id) ? { name: nameById.get(r.customer_id)! } : null,
  }));
}

export function summarizeRatings(reviews: Pick<Review, "rating">[]): {
  average: number;
  count: number;
} {
  if (reviews.length === 0) return { average: 0, count: 0 };
  const total = reviews.reduce((sum, r) => sum + r.rating, 0);
  return { average: total / reviews.length, count: reviews.length };
}
