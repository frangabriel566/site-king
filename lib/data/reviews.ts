import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Tables } from "@/lib/database.types";
import { requireAdminPage } from "@/lib/auth/guards";
import { formatCustomerName } from "@/lib/format";

export type Review = Tables<"reviews"> & {
  customer: { name: string } | null;
};

export type AdminReview = Review & {
  product: { name: string; slug: string } | null;
};

const { reviews } = schema;

/** Public read. `customer_id` is the reviewer's user id; the display name
 * comes from their customers row, and a reviewer without one (an admin,
 * say) shows as anonymous rather than as an error. */
export async function getProductReviews(productId: string): Promise<Review[]> {
  const rows = await getDb().query.reviews.findMany({
    where: eq(reviews.product_id, productId),
    orderBy: desc(reviews.created_at),
    with: { customer: { columns: { name: true } } },
  });
  // Shortened here, on the server ("Carlos M."): the list is rendered by
  // a client component, and anything handed to it is in the page's HTML.
  return rows.map((row) => ({
    ...row,
    customer: row.customer ? { name: formatCustomerName(row.customer.name) } : null,
  }));
}

/** Every review across every product, newest first — the moderation
 * list at /admin/avaliacoes. */
export async function getAllReviewsAdmin(): Promise<AdminReview[]> {
  await requireAdminPage();
  return getDb().query.reviews.findMany({
    orderBy: desc(reviews.created_at),
    with: {
      customer: { columns: { name: true } },
      product: { columns: { name: true, slug: true } },
    },
  });
}

export function summarizeRatings(reviews: Pick<Review, "rating">[]): {
  average: number;
  count: number;
} {
  if (reviews.length === 0) return { average: 0, count: 0 };
  const total = reviews.reduce((sum, r) => sum + r.rating, 0);
  return { average: total / reviews.length, count: reviews.length };
}
