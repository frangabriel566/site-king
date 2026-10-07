"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { categorySchema } from "@/lib/validations/category";
import { slugify } from "@/lib/format";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb, schema } from "@/lib/db";
import { runBatch } from "@/lib/db/batch";
import { isUniqueViolation } from "@/lib/db/errors";
import { productIdsLinkedTo, refreshSearchText } from "@/lib/catalog/search-index";

export type ActionResult = { status: "idle" | "error" | "success"; message?: string };

const { categories } = schema;

function revalidateStorefront() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/categorias");
}

function parseCategoryForm(formData: FormData) {
  return categorySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    position: formData.get("position"),
    active: formData.get("active") === "on",
  });
}

function saveError(error: unknown, duplicate: string): string {
  if (isUniqueViolation(error, "categories.slug")) return duplicate;
  console.error("[categories]", error);
  return "Não foi possível salvar a categoria.";
}

export async function createCategoryAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseCategoryForm(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  await requireAdmin();
  try {
    await getDb().insert(categories).values(parsed.data);
  } catch (error) {
    return { status: "error", message: saveError(error, "Já existe uma categoria com esse slug.") };
  }

  revalidateStorefront();
  redirect("/admin/categorias");
}

export type QuickCreateCategoryResult =
  | { ok: true; category: { id: string; name: string; slug: string } }
  | { ok: false; message: string };

/**
 * Embedded creation for the product form's "criar categoria" option —
 * no redirect, just the created row, so the operator never leaves the
 * product they're editing.
 */
export async function quickCreateCategoryAction(name: string): Promise<QuickCreateCategoryResult> {
  const parsed = categorySchema.safeParse({
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
    const [category] = await getDb()
      .insert(categories)
      .values(parsed.data)
      .returning({ id: categories.id, name: categories.name, slug: categories.slug });
    revalidateStorefront();
    return { ok: true, category };
  } catch (error) {
    return { ok: false, message: saveError(error, "Já existe uma categoria com esse nome.") };
  }
}

export async function updateCategoryAction(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseCategoryForm(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  await requireAdmin();
  try {
    await getDb().update(categories).set(parsed.data).where(eq(categories.id, id));
  } catch (error) {
    return { status: "error", message: saveError(error, "Já existe uma categoria com esse slug.") };
  }

  // The category name is part of every one of its products' search text.
  await refreshSearchText({ categoryId: id });

  revalidateStorefront();
  redirect("/admin/categorias");
}

export async function deleteCategoryAction(id: string): Promise<{ ok: boolean; message?: string }> {
  await requireAdmin();
  const affected = await productIdsLinkedTo({ categoryId: id });
  // category_id is ON DELETE SET NULL — this only ever clears the link on
  // its products, never the products themselves.
  await getDb().delete(categories).where(eq(categories.id, id));
  await refreshSearchText({ productIds: affected });
  revalidateStorefront();
  return { ok: true };
}

export async function reorderCategoriesAction(
  orderedIds: string[],
): Promise<{ ok: boolean }> {
  await requireAdmin();
  const db = getDb();
  await runBatch(
    db,
    orderedIds.map((id, index) =>
      db.update(categories).set({ position: index }).where(eq(categories.id, id)),
    ),
  );
  revalidateStorefront();
  return { ok: true };
}
