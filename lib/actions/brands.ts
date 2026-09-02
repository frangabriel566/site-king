"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { brandSchema } from "@/lib/validations/brand";
import { slugify } from "@/lib/format";
import { requireAdmin } from "./require-admin";

export type ActionResult = { status: "idle" | "error" | "success"; message?: string };

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

export async function createBrandAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseBrandForm(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("brands").insert(parsed.data);

  if (error) {
    return {
      status: "error",
      message: error.code === "23505" ? "Já existe uma marca com esse slug." : error.message,
    };
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

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("brands")
    .insert(parsed.data)
    .select("id, name, slug")
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: error?.code === "23505" ? "Já existe uma marca com esse nome." : (error?.message ?? "Erro"),
    };
  }

  revalidateStorefront();
  return { ok: true, brand: data };
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

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("brands")
    .update(parsed.data)
    .eq("id", id);

  if (error) {
    return {
      status: "error",
      message: error.code === "23505" ? "Já existe uma marca com esse slug." : error.message,
    };
  }

  revalidateStorefront();
  redirect("/admin/marcas");
}

export async function deleteBrandAction(id: string): Promise<{ ok: boolean; message?: string }> {
  const { supabase } = await requireAdmin();
  // brand_id is ON DELETE SET NULL (see 0008_brands.sql) — this only ever
  // clears products.brand_id, it never touches the products themselves.
  const { error } = await supabase.from("brands").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateStorefront();
  return { ok: true };
}

export async function reorderBrandsAction(orderedIds: string[]): Promise<{ ok: boolean }> {
  const { supabase } = await requireAdmin();
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("brands").update({ position: index }).eq("id", id),
    ),
  );
  revalidateStorefront();
  return { ok: true };
}
