"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { bannerSchema } from "@/lib/validations/banner";
import { requireAdmin } from "./require-admin";

type BannerInput = z.infer<typeof bannerSchema>;

export type ActionResult = { status: "idle" | "error" | "success"; message?: string };

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

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("banners").insert(toRow(parsed.data));
  if (error) return { status: "error", message: error.message };

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

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("banners")
    .update(toRow(parsed.data))
    .eq("id", id);
  if (error) return { status: "error", message: error.message };

  revalidateStorefront();
  redirect("/admin/banners");
}

export async function deleteBannerAction(id: string): Promise<{ ok: boolean; message?: string }> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("banners").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateStorefront();
  return { ok: true };
}

export async function toggleBannerActiveAction(
  id: string,
  active: boolean,
): Promise<{ ok: boolean }> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("banners").update({ active }).eq("id", id);
  revalidateStorefront();
  return { ok: !error };
}

export async function reorderBannersAction(
  orderedIds: string[],
): Promise<{ ok: boolean }> {
  const { supabase } = await requireAdmin();
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("banners").update({ position: index }).eq("id", id),
    ),
  );
  revalidateStorefront();
  return { ok: true };
}
