"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { brandSchema } from "@/lib/validations/brand";
import { slugify } from "@/lib/format";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb, schema } from "@/lib/db";
import { runBatch } from "@/lib/db/batch";
import { isUniqueViolation } from "@/lib/db/errors";
import { productIdsLinkedTo, refreshSearchText } from "@/lib/catalog/search-index";
import { releaseImages, removedUrls } from "@/lib/media/images";

export type ActionResult = { status: "idle" | "error" | "success"; message?: string };

const { brands } = schema;

function revalidateStorefront() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/marcas");
}

function parseBrandForm(formData: FormData) {
  return brandSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    logo_url: formData.get("logo_url") || null,
    description: formData.get("description") || null,
    position: formData.get("position"),
    active: formData.get("active") === "on",
  });
}

function saveError(error: unknown, duplicate: string): string {
  if (isUniqueViolation(error, "brands.slug")) return duplicate;
  console.error("[brands]", error);
  return "Não foi possível salvar a marca.";
}

export async function createBrandAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseBrandForm(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  await requireAdmin();
  try {
    await getDb().insert(brands).values(parsed.data);
  } catch (error) {
    return { status: "error", message: saveError(error, "Já existe uma marca com esse slug.") };
  }

  revalidateStorefront();
  redirect("/admin/marcas");
}

export type QuickCreateBrandResult =
  | { ok: true; brand: { id: string; name: string; slug: string } }
  | { ok: false; message: string };

/**
 * Embedded creation for the product form's "criar marca" option — no
 * redirect, just the created row, so the operator never leaves the
 * product they're editing. Mirrors quickCreateCategoryAction.
 */
export async function quickCreateBrandAction(name: string): Promise<QuickCreateBrandResult> {
  const parsed = brandSchema.safeParse({
    name,
    slug: slugify(name),
    position: 999,
    active: true,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Nome inválido." };
  }

  await requireAdmin();
  try {
    const [brand] = await getDb()
      .insert(brands)
      .values(parsed.data)
      .returning({ id: brands.id, name: brands.name, slug: brands.slug });
    revalidateStorefront();
    return { ok: true, brand };
  } catch (error) {
    return { ok: false, message: saveError(error, "Já existe uma marca com esse nome.") };
  }
}

export async function updateBrandAction(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseBrandForm(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  await requireAdmin();
  const db = getDb();
  const [before] = await db.select({ logo_url: brands.logo_url }).from(brands).where(eq(brands.id, id));
  try {
    await db.update(brands).set(parsed.data).where(eq(brands.id, id));
  } catch (error) {
    return { status: "error", message: saveError(error, "Já existe uma marca com esse slug.") };
  }

  if (before) await releaseImages(removedUrls([before.logo_url], [parsed.data.logo_url]));
  // The brand name is part of every one of its products' search text.
  await refreshSearchText({ brandId: id });

  revalidateStorefront();
  redirect("/admin/marcas");
}

export async function deleteBrandAction(id: string): Promise<{ ok: boolean; message?: string }> {
  await requireAdmin();
  const affected = await productIdsLinkedTo({ brandId: id });
  // brand_id is ON DELETE SET NULL — this only ever clears products.brand_id,
  // it never touches the products themselves.
  const [removed] = await getDb()
    .delete(brands)
    .where(eq(brands.id, id))
    .returning({ logo_url: brands.logo_url });
  if (removed) await releaseImages([removed.logo_url]);
  await refreshSearchText({ productIds: affected });
  revalidateStorefront();
  return { ok: true };
}

export async function reorderBrandsAction(orderedIds: string[]): Promise<{ ok: boolean }> {
  await requireAdmin();
  const db = getDb();
  await runBatch(
    db,
    orderedIds.map((id, index) => db.update(brands).set({ position: index }).where(eq(brands.id, id))),
  );
  revalidateStorefront();
  return { ok: true };
}
