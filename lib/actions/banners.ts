"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { eq } from "drizzle-orm";
import { bannerSchema } from "@/lib/validations/banner";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb, schema } from "@/lib/db";
import { runBatch } from "@/lib/db/batch";

type BannerInput = z.infer<typeof bannerSchema>;

export type ActionResult = { status: "idle" | "error" | "success"; message?: string };

const { banners } = schema;

function revalidateStorefront() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/banners");
}

function parseFormData(formData: FormData) {
  return bannerSchema.safeParse({
    eyebrow: formData.get("eyebrow"),
    headline_line1: formData.get("headline_line1"),
    headline_line2: formData.get("headline_line2"),
    wordmark: formData.get("wordmark"),
    cta_label: formData.get("cta_label"),
    cta_href: formData.get("cta_href"),
    image_url: formData.get("image_url"),
    cutout_url: formData.get("cutout_url"),
    featured_product_id: formData.get("featured_product_id") || null,
    active: formData.get("active") === "on",
    position: formData.get("position"),
  });
}

function toRow(data: BannerInput) {
  return {
    eyebrow: data.eyebrow || null,
    headline_line1: data.headline_line1 || null,
    headline_line2: data.headline_line2 || null,
    wordmark: data.wordmark || null,
    cta_label: data.cta_label || null,
    cta_href: data.cta_href || null,
    image_url: data.image_url || null,
    cutout_url: data.cutout_url || null,
    featured_product_id: data.featured_product_id || null,
    active: data.active,
    position: data.position,
  };
}

export async function createBannerAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  await requireAdmin();
  try {
    await getDb().insert(banners).values(toRow(parsed.data));
  } catch (error) {
    console.error("[createBannerAction]", error);
    return { status: "error", message: "Não foi possível salvar o banner." };
  }

  revalidateStorefront();
  redirect("/admin/banners");
}

export async function updateBannerAction(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  await requireAdmin();
  try {
    await getDb().update(banners).set(toRow(parsed.data)).where(eq(banners.id, id));
  } catch (error) {
    console.error("[updateBannerAction]", error);
    return { status: "error", message: "Não foi possível salvar o banner." };
  }

  revalidateStorefront();
  redirect("/admin/banners");
}

export async function deleteBannerAction(id: string): Promise<{ ok: boolean; message?: string }> {
  await requireAdmin();
  await getDb().delete(banners).where(eq(banners.id, id));
  revalidateStorefront();
  return { ok: true };
}

export async function toggleBannerActiveAction(
  id: string,
  active: boolean,
): Promise<{ ok: boolean }> {
  await requireAdmin();
  const updated = await getDb()
    .update(banners)
    .set({ active })
    .where(eq(banners.id, id))
    .returning({ id: banners.id });
  revalidateStorefront();
  return { ok: updated.length > 0 };
}

export async function reorderBannersAction(
  orderedIds: string[],
): Promise<{ ok: boolean }> {
  await requireAdmin();
  const db = getDb();
  await runBatch(
    db,
    orderedIds.map((id, index) => db.update(banners).set({ position: index }).where(eq(banners.id, id))),
  );
  revalidateStorefront();
  return { ok: true };
}
