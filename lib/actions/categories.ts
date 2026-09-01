"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { categorySchema } from "@/lib/validations/category";
import { requireAdmin } from "./require-admin";

export type ActionResult = { status: "idle" | "error" | "success"; message?: string };

function revalidateStorefront() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/categorias");
}

export async function createCategoryAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    position: formData.get("position"),
    active: formData.get("active") === "on",
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("categories").insert(parsed.data);

  if (error) {
    return {
      status: "error",
      message: error.code === "23505" ? "Já existe uma categoria com esse slug." : error.message,
    };
  }

  revalidateStorefront();
  redirect("/admin/categorias");
}

export async function updateCategoryAction(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    position: formData.get("position"),
    active: formData.get("active") === "on",
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("categories")
    .update(parsed.data)
    .eq("id", id);

  if (error) {
    return {
      status: "error",
      message: error.code === "23505" ? "Já existe uma categoria com esse slug." : error.message,
    };
  }

  revalidateStorefront();
  redirect("/admin/categorias");
}

export async function deleteCategoryAction(id: string): Promise<{ ok: boolean; message?: string }> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateStorefront();
  return { ok: true };
}

export async function reorderCategoriesAction(
  orderedIds: string[],
): Promise<{ ok: boolean }> {
  const { supabase } = await requireAdmin();
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("categories").update({ position: index }).eq("id", id),
    ),
  );
  revalidateStorefront();
  return { ok: true };
}
