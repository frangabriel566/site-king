"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { collectPublishIssues, productSchema } from "@/lib/validations/product";
import { requireAdmin } from "./require-admin";

export type ActionResult = { status: "idle" | "error" | "success"; message?: string };

function revalidateStorefront(slug?: string) {
  revalidatePath("/");
  revalidatePath("/colecao");
  revalidatePath("/admin/produtos");
  revalidatePath("/admin/estoque");
  if (slug) revalidatePath(`/produto/${slug}`);
}

function parseFormData(formData: FormData) {
  let images: unknown = [];
  let variants: unknown = [];
  try {
    images = JSON.parse(String(formData.get("images_json") ?? "[]"));
  } catch {
    images = [];
  }
  try {
    variants = JSON.parse(String(formData.get("variants_json") ?? "[]"));
  } catch {
    variants = [];
  }

  return productSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    price: formData.get("price"),
    compare_at_price: formData.get("compare_at_price") || null,
    category_id: formData.get("category_id") || null,
    status: formData.get("status"),
    featured: formData.get("featured") === "on",
    position: formData.get("position"),
    images,
    variants,
  });
}

function friendlyDbError(error: { code?: string; message: string } | null): string | undefined {
  if (!error) return undefined;
  if (error.code === "23505") {
    if (error.message.includes("sku")) return "Um dos SKUs já está em uso por outra variação.";
    if (error.message.includes("slug")) return "Já existe um produto com esse slug.";
  }
  return error.message;
}

export async function createProductAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }
  const { name, slug, description, price, compare_at_price, category_id, status, featured, position, images, variants } =
    parsed.data;

  // Defense in depth: the client already blocks publishing with missing
  // fields, but the server must not trust that — this is the real gate.
  const publishIssues = collectPublishIssues(parsed.data);
  if (publishIssues.length > 0) {
    return { status: "error", message: publishIssues[0].message };
  }

  const { supabase } = await requireAdmin();

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      name,
      slug,
      description: description || null,
      price,
      compare_at_price: compare_at_price ?? null,
      category_id,
      status,
      featured,
      position,
    })
    .select("id")
    .single();

  if (error || !product) {
    return { status: "error", message: friendlyDbError(error) };
  }

  if (images.length > 0) {
    await supabase.from("product_images").insert(
      images.map((img, index) => ({
        product_id: product.id,
        url: img.url,
        alt: img.alt || null,
        position: index,
      })),
    );
  }

  if (variants.length > 0) {
    const { error: variantsError } = await supabase.from("product_variants").insert(
      variants.map((v) => ({
        product_id: product.id,
        color: v.color,
        color_hex: v.color_hex || null,
        size: v.size,
        sku: v.sku,
        stock: v.stock,
        weight_grams: v.weight_grams ?? null,
        length_cm: v.length_cm ?? null,
        width_cm: v.width_cm ?? null,
        height_cm: v.height_cm ?? null,
      })),
    );
    if (variantsError) {
      return { status: "error", message: friendlyDbError(variantsError) };
    }
  }

  revalidateStorefront(slug);
  redirect("/admin/produtos");
}

export async function updateProductAction(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }
  const { name, slug, description, price, compare_at_price, category_id, status, featured, position, images, variants } =
    parsed.data;

  const publishIssues = collectPublishIssues(parsed.data);
  if (publishIssues.length > 0) {
    return { status: "error", message: publishIssues[0].message };
  }

  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("products")
    .update({
      name,
      slug,
      description: description || null,
      price,
      compare_at_price: compare_at_price ?? null,
      category_id,
      status,
      featured,
      position,
    })
    .eq("id", id);

  if (error) {
    return { status: "error", message: friendlyDbError(error) };
  }

  await supabase.from("product_images").delete().eq("product_id", id);
  if (images.length > 0) {
    await supabase.from("product_images").insert(
      images.map((img, index) => ({
        product_id: id,
        url: img.url,
        alt: img.alt || null,
        position: index,
      })),
    );
  }

  await supabase.from("product_variants").delete().eq("product_id", id);
  if (variants.length > 0) {
    const { error: variantsError } = await supabase.from("product_variants").insert(
      variants.map((v) => ({
        product_id: id,
        color: v.color,
        color_hex: v.color_hex || null,
        size: v.size,
        sku: v.sku,
        stock: v.stock,
        weight_grams: v.weight_grams ?? null,
        length_cm: v.length_cm ?? null,
        width_cm: v.width_cm ?? null,
        height_cm: v.height_cm ?? null,
      })),
    );
    if (variantsError) {
      return { status: "error", message: friendlyDbError(variantsError) };
    }
  }

  revalidateStorefront(slug);
  redirect("/admin/produtos");
}

export async function deleteProductAction(id: string): Promise<{ ok: boolean; message?: string }> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateStorefront();
  return { ok: true };
}

export async function updateVariantStockAction(
  variantId: string,
  stock: number,
): Promise<{ ok: boolean; message?: string }> {
  if (stock < 0) return { ok: false, message: "Estoque não pode ser negativo." };
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("product_variants")
    .update({ stock })
    .eq("id", variantId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/estoque");
  revalidatePath("/admin/produtos");
  revalidatePath("/colecao");
  return { ok: true };
}
