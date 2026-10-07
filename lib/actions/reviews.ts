"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { reviewSchema } from "@/lib/validations/review";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import { getDb, schema } from "@/lib/db";

export type ActionResult = { status: "idle" | "error" | "success"; message?: string };

const { reviews } = schema;

export async function submitReviewAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse({
    product_id: formData.get("product_id"),
    rating: formData.get("rating"),
    comment: formData.get("comment"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Entre na sua conta para avaliar este produto." };
  }

  const { product_id, rating, comment } = parsed.data;
  try {
    // One row per (product, customer) — a repeat submission overwrites the
    // shopper's own previous review instead of erroring on the unique
    // constraint or piling up duplicates.
    await getDb()
      .insert(reviews)
      .values({ product_id, customer_id: user.id, rating, comment: comment || null })
      .onConflictDoUpdate({
        target: [reviews.product_id, reviews.customer_id],
        set: { rating, comment: comment || null },
      });
  } catch (error) {
    console.error("[submitReviewAction]", error);
    return { status: "error", message: "Não foi possível salvar sua avaliação." };
  }

  const slug = formData.get("slug");
  if (typeof slug === "string" && slug) revalidatePath(`/produto/${slug}`);

  return { status: "success" };
}

/** A customer removing their own review — never anyone else's. */
export async function deleteReviewAction(reviewId: string, slug: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };

  const deleted = await getDb()
    .delete(reviews)
    .where(and(eq(reviews.id, reviewId), eq(reviews.customer_id, user.id)))
    .returning({ id: reviews.id });

  if (deleted.length > 0) revalidatePath(`/produto/${slug}`);
  return { ok: deleted.length > 0 };
}

export async function deleteReviewAdminAction(
  reviewId: string,
  slug: string,
): Promise<{ ok: boolean; message?: string }> {
  await requireAdmin();
  await getDb().delete(reviews).where(eq(reviews.id, reviewId));

  revalidatePath("/admin/avaliacoes");
  revalidatePath(`/produto/${slug}`);
  return { ok: true };
}
