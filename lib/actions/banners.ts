"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { eq } from "drizzle-orm";
import { bannerSchema } from "@/lib/validations/banner";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb, schema } from "@/lib/db";
import { runBatch } from "@/lib/db/batch";
import { releaseImages, removedUrls } from "@/lib/media/images";
import { ensureBannerColumns } from "@/lib/db/ensure-banner-columns";
import { parseExtraImages } from "@/lib/banner-style";

type BannerInput = z.infer<typeof bannerSchema>;

export type ActionResult = { status: "idle" | "error" | "success"; message?: string };

const { banners } = schema;

function revalidateStorefront() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/banners");
}

function parseStyle(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string" || !raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function parseList(raw: FormDataEntryValue | null): unknown {
  const value = parseStyle(raw);
  return Array.isArray(value) ? value : [];
}

function parseFormData(formData: FormData) {
  return bannerSchema.safeParse({
    kind: formData.get("kind") || "editavel",
    eyebrow: formData.get("eyebrow") ?? "",
    eyebrow_highlight: formData.get("eyebrow_highlight") ?? "",
    headline_line1: formData.get("headline_line1") ?? "",
    headline_line2: formData.get("headline_line2") ?? "",
    subtitle: formData.get("subtitle") ?? "",
    cta_label: formData.get("cta_label") ?? "",
    cta_href: formData.get("cta_href") ?? "",
    whatsapp_label: formData.get("whatsapp_label") ?? "",
    show_whatsapp: formData.get("show_whatsapp") === "on",
    badge: formData.get("badge") ?? "",
    image_url: formData.get("image_url") ?? "",
    mobile_image_url: formData.get("mobile_image_url") ?? "",
    extra_images: parseList(formData.get("extra_images")),
    wordmark: formData.get("wordmark") ?? "",
    cutout_url: formData.get("cutout_url") ?? "",
    featured_product_id: formData.get("featured_product_id") || null,
    style: parseStyle(formData.get("style")),
    active: formData.get("active") === "on",
    position: formData.get("position") ?? 0,
  });
}

function toRow(data: BannerInput) {
  return {
    kind: data.kind,
    eyebrow: data.eyebrow || null,
    eyebrow_highlight: data.eyebrow_highlight || null,
    headline_line1: data.headline_line1 || null,
    headline_line2: data.headline_line2 || null,
    subtitle: data.subtitle || null,
    cta_label: data.cta_label || null,
    cta_href: data.cta_href || null,
    whatsapp_label: data.whatsapp_label || null,
    show_whatsapp: data.show_whatsapp,
    badge: data.badge || null,
    image_url: data.image_url || null,
    mobile_image_url: data.mobile_image_url || null,
    // A finished image has no photo carousel.
    extra_images:
      data.kind === "pronto" || data.extra_images.length === 0
        ? null
        : JSON.stringify(data.extra_images),
    wordmark: data.wordmark || null,
    cutout_url: data.cutout_url || null,
    featured_product_id: data.featured_product_id || null,
    style: JSON.stringify(data.style),
    active: data.active,
    position: data.position,
  };
}

const IMAGE_FIELDS = {
  image_url: banners.image_url,
  cutout_url: banners.cutout_url,
  mobile_image_url: banners.mobile_image_url,
  extra_images: banners.extra_images,
};

/** Every image URL a banner row holds. */
function imageUrlsOf(row: {
  image_url: string | null;
  cutout_url: string | null;
  mobile_image_url: string | null;
  extra_images: string | null;
}): (string | null)[] {
  return [row.image_url, row.cutout_url, row.mobile_image_url, ...parseExtraImages(row.extra_images)];
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
    await ensureBannerColumns();
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
  await ensureBannerColumns();
  const db = getDb();
  const [before] = await db
    .select(IMAGE_FIELDS)
    .from(banners)
    .where(eq(banners.id, id));
  const row = toRow(parsed.data);
  try {
    await db.update(banners).set(row).where(eq(banners.id, id));
  } catch (error) {
    console.error("[updateBannerAction]", error);
    return { status: "error", message: "Não foi possível salvar o banner." };
  }

  // A swapped or removed background/cutout leaves KV (if nothing else uses it).
  if (before) {
    await releaseImages(
      removedUrls(imageUrlsOf(before), imageUrlsOf(row)),
    );
  }

  revalidateStorefront();
  redirect("/admin/banners");
}

export async function deleteBannerAction(id: string): Promise<{ ok: boolean; message?: string }> {
  await requireAdmin();
  await ensureBannerColumns();
  const [removed] = await getDb()
    .delete(banners)
    .where(eq(banners.id, id))
    .returning(IMAGE_FIELDS);
  if (removed) {
    await releaseImages(imageUrlsOf(removed));
  }
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
