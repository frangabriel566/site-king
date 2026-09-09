"use server";

import { revalidatePath } from "next/cache";
import { reviewSchema } from "@/lib/validations/review";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { status: "idle" | "error" | "success"; message?: string };

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "Entre na sua conta para avaliar este produto." };
  }

  const { product_id, rating, comment } = parsed.data;
  // One row per (product, customer) — a repeat submission overwrites the
  // shopper's own previous review instead of erroring on the unique
  // constraint or piling up duplicates.
  const { error } = await supabase
    .from("reviews")
    .upsert(
      { product_id, customer_id: user.id, rating, comment: comment || null },
      { onConflict: "product_id,customer_id" },
    );

  if (error) return { status: "error", message: error.message };

  const slug = formData.get("slug");
  if (typeof slug === "string" && slug) revalidatePath(`/produto/${slug}`);

  return { status: "success" };
}

export async function deleteReviewAction(reviewId: string, slug: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("reviews")
    .delete()
    .eq("id", reviewId)
    .eq("customer_id", user.id);

  if (!error) revalidatePath(`/produto/${slug}`);
  return { ok: !error };
}
