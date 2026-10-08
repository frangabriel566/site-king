"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb, schema } from "@/lib/db";
import { insertChunks, runBatch } from "@/lib/db/batch";
import { deleteObject } from "@/lib/storage";
import { keyFromImageUrl, thumbnailKey } from "@/lib/image-url";
import { feedbackSchema, type FeedbackInput } from "@/lib/validations/feedback";

export type ActionResult = { status: "idle" | "error" | "success"; message?: string };

const { feedbacks, feedback_images } = schema;

function parseFormData(formData: FormData) {
  let images: unknown = [];
  try {
    images = JSON.parse(String(formData.get("images_json") ?? "[]"));
  } catch {
    images = [];
  }
  return feedbackSchema.safeParse({
    customer_name: formData.get("customer_name") ?? "",
    customer_location: formData.get("customer_location"),
    text: formData.get("text"),
    rating: formData.get("rating"),
    product_id: formData.get("product_id"),
    show_on_home: formData.get("show_on_home") === "on",
    active: formData.get("active") === "on",
    position: formData.get("position"),
    feedback_date: formData.get("feedback_date"),
    images,
  });
}

function feedbackRow(data: FeedbackInput) {
  const { images: _images, ...row } = data;
  void _images;
  return row;
}

function imageRows(feedbackId: string, data: FeedbackInput) {
  return data.images.map((image, index) => ({
    feedback_id: feedbackId,
    url: image.url,
    kind: image.kind,
    position: index,
    width: image.width ?? null,
    height: image.height ?? null,
  }));
}

/** Our uploads among `urls` (photo + thumbnail), out of Workers KV. Best
 * effort: a file left behind is wasted space, never a broken page. */
async function deleteUploads(urls: string[]) {
  const keys = urls.flatMap((url) => {
    const key = keyFromImageUrl(url);
    return key ? [key, thumbnailKey(key)] : [];
  });
  await Promise.allSettled(keys.map((key) => deleteObject(key)));
}

function revalidateFeedbacks() {
  revalidatePath("/admin/feedbacks");
  // The home and every product page read them.
  revalidatePath("/", "layout");
}

export async function createFeedbackAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseFormData(formData);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  await requireAdmin();
  const db = getDb();
  const id = crypto.randomUUID();
  try {
    await runBatch(db, [
      db.insert(feedbacks).values({ id, ...feedbackRow(parsed.data) }),
      ...insertChunks(db, feedback_images, imageRows(id, parsed.data)),
    ]);
  } catch (error) {
    console.error("[feedbacks] create", error);
    return { status: "error", message: "Não foi possível salvar o feedback." };
  }

  revalidateFeedbacks();
  redirect("/admin/feedbacks");
}

export async function updateFeedbackAction(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseFormData(formData);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };

  await requireAdmin();
  const db = getDb();
  const before = await db
    .select({ url: feedback_images.url })
    .from(feedback_images)
    .where(eq(feedback_images.feedback_id, id));
  try {
    // Images carry nothing anyone points at, so the list is simply
    // replaced — in the same transaction as the feedback.
    await runBatch(db, [
      db.update(feedbacks).set(feedbackRow(parsed.data)).where(eq(feedbacks.id, id)),
      db.delete(feedback_images).where(eq(feedback_images.feedback_id, id)),
      ...insertChunks(db, feedback_images, imageRows(id, parsed.data)),
    ]);
  } catch (error) {
    console.error("[feedbacks] update", error);
    return { status: "error", message: "Não foi possível salvar o feedback." };
  }

  // Files the feedback no longer uses (removed in the form).
  const kept = new Set(parsed.data.images.map((image) => image.url));
  await deleteUploads(before.map((row) => row.url).filter((url) => !kept.has(url)));

  revalidateFeedbacks();
  redirect("/admin/feedbacks");
}

export async function toggleFeedbackAction(
  id: string,
  field: "active" | "show_on_home",
  value: boolean,
): Promise<{ ok: boolean }> {
  await requireAdmin();
  const updated = await getDb()
    .update(feedbacks)
    .set(field === "active" ? { active: value } : { show_on_home: value })
    .where(eq(feedbacks.id, id))
    .returning({ id: feedbacks.id });
  revalidateFeedbacks();
  return { ok: updated.length > 0 };
}

export async function deleteFeedbackAction(id: string): Promise<{ ok: boolean; message?: string }> {
  await requireAdmin();
  const db = getDb();
  const images = await db
    .select({ url: feedback_images.url })
    .from(feedback_images)
    .where(eq(feedback_images.feedback_id, id));
  // feedback_images go with it (ON DELETE CASCADE); then their files.
  await db.delete(feedbacks).where(eq(feedbacks.id, id));
  await deleteUploads(images.map((image) => image.url));
  revalidateFeedbacks();
  return { ok: true };
}
