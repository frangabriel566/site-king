"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { collectPublishIssues, productSchema } from "@/lib/validations/product";
import { requireAdmin } from "./require-admin";

export type ActionResult = { status: "idle" | "error" | "success"; message?: string };

/**
 * `("/", "layout")` rather than a list of pages, matching what the brand
 * and category actions already do.
 *
 * The page-scoped form only clears the exact routes named, and products
 * surface on more of them than a list can keep up with: /marca/[slug] was
 * missing outright, and a page-scoped call leaves the client router cache
 * for other segments holding its old payload — so a product saved in the
 * admin stayed invisible on the storefront until some *other* action
 * (editing a brand, say) invalidated the tree the broad way.
 *
 * Over-invalidating costs a re-render of pages that did not change. Under-
 * invalidating costs the operator trusting the panel, which is worse.
 */
function revalidateStorefront(slug?: string) {
  revalidatePath("/", "layout");
  revalidatePath("/admin/produtos");
  revalidatePath("/admin/estoque");
  if (slug) revalidatePath(`/produto/${slug}`);
}

function parseFormData(formData: FormData) {
  let images: unknown = [];
  let variants: unknown = [];
  let attributes: unknown = null;
  let tags: unknown = [];
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
  try {
    const raw = formData.get("attributes_json");
    attributes = raw ? JSON.parse(String(raw)) : null;
  } catch {
    attributes = null;
  }
  try {
    tags = JSON.parse(String(formData.get("tags_json") ?? "[]"));
  } catch {
    tags = [];
  }

  return productSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    short_description: formData.get("short_description") || "",
    description: formData.get("description"),
    video_url: formData.get("video_url") || "",
    tags,
    collection: formData.get("collection") || "",
    shipping_note: formData.get("shipping_note") || "",
    exchange_info: formData.get("exchange_info") || "",
    care_instructions: formData.get("care_instructions") || "",
    price: formData.get("price"),
    compare_at_price: formData.get("compare_at_price") || null,
    category_id: formData.get("category_id") || null,
    brand_id: formData.get("brand_id") || null,
    manufacturer_ref: formData.get("manufacturer_ref") || "",
    weight_grams: formData.get("weight_grams") || null,
    length_cm: formData.get("length_cm") || null,
    width_cm: formData.get("width_cm") || null,
    height_cm: formData.get("height_cm") || null,
    attributes,
    badge: formData.get("badge") || null,
    status: formData.get("status"),
    featured: formData.get("featured") === "on",
    position: formData.get("position"),
    images,
    variants,
  });
}

function friendlyDbError(
  error: { code?: string; message: string; details?: string | null } | null,
): string | undefined {
  if (!error) return undefined;
  if (error.code === "23505") {
    // Postgres' detail for a unique-violation looks like
    // `Key (sku)=(SAPATO-VERDE-40) already exists.` — surface the actual
    // value so the operator knows which SKU to change, instead of a
    // generic "one of them" that leaves them guessing across every row.
    const skuMatch = error.details?.match(/Key \(sku\)=\(([^)]+)\)/);
    if (skuMatch) return `O SKU "${skuMatch[1]}" já está em uso por outra variação.`;
    if (error.message.includes("sku")) return "Um dos SKUs já está em uso por outra variação.";
    if (error.message.includes("slug")) return "Já existe um produto com esse slug.";
  }
  return error.message;
}

/**
 * "Salvar e criar outro" always lands on a fresh /novo, carrying over
 * category and brand — whether the save that triggered it was a create
 * or an edit.
 */
function redirectAfterSave(
  formData: FormData,
  categoryId: string | null | undefined,
  brandId: string | null | undefined,
): never {
  if (formData.get("intent") !== "save_and_new") {
    redirect("/admin/produtos");
  }

  const params = new URLSearchParams();
  if (categoryId) params.set("categoria", categoryId);
  if (brandId) params.set("marca", brandId);

  const query = params.toString();
  redirect(`/admin/produtos/novo${query ? `?${query}` : ""}`);
}

function buildSku(slug: string, color: string, size: string): string {
  const parts = [slug, color, size].filter((p) => p && p.trim());
  if (parts.length === 0) return "";
  return parts
    .join(" ")
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

export async function createProductAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }
  const {
    name,
    slug,
    short_description,
    description,
    video_url,
    tags,
    collection,
    shipping_note,
    exchange_info,
    care_instructions,
    price,
    compare_at_price,
    category_id,
    brand_id,
    manufacturer_ref,
    weight_grams,
    length_cm,
    width_cm,
    height_cm,
    attributes,
    badge,
    status,
    featured,
    position,
    images,
    variants,
  } = parsed.data;

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
      short_description: short_description || null,
      description: description || null,
      video_url: video_url || null,
      tags: tags.length > 0 ? tags : null,
      collection: collection || null,
      shipping_note: shipping_note || null,
      exchange_info: exchange_info || null,
      care_instructions: care_instructions || null,
      price,
      compare_at_price: compare_at_price ?? null,
      category_id,
      brand_id,
      manufacturer_ref: manufacturer_ref || null,
      weight_grams: weight_grams ?? null,
      length_cm: length_cm ?? null,
      width_cm: width_cm ?? null,
      height_cm: height_cm ?? null,
      attributes: attributes ?? null,
      badge: badge ?? null,
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
        image_url: v.image_url || null,
      })),
    );
    if (variantsError) {
      return { status: "error", message: friendlyDbError(variantsError) };
    }
  }

  revalidateStorefront(slug);
  redirectAfterSave(formData, category_id, brand_id);
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
  const {
    name,
    slug,
    short_description,
    description,
    video_url,
    tags,
    collection,
    shipping_note,
    exchange_info,
    care_instructions,
    price,
    compare_at_price,
    category_id,
    brand_id,
    manufacturer_ref,
    weight_grams,
    length_cm,
    width_cm,
    height_cm,
    attributes,
    badge,
    status,
    featured,
    position,
    images,
    variants,
  } = parsed.data;

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
      short_description: short_description || null,
      description: description || null,
      video_url: video_url || null,
      tags: tags.length > 0 ? tags : null,
      collection: collection || null,
      shipping_note: shipping_note || null,
      exchange_info: exchange_info || null,
      care_instructions: care_instructions || null,
      price,
      compare_at_price: compare_at_price ?? null,
      category_id,
      brand_id,
      manufacturer_ref: manufacturer_ref || null,
      weight_grams: weight_grams ?? null,
      length_cm: length_cm ?? null,
      width_cm: width_cm ?? null,
      height_cm: height_cm ?? null,
      attributes: attributes ?? null,
      badge: badge ?? null,
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
        image_url: v.image_url || null,
      })),
    );
    if (variantsError) {
      return { status: "error", message: friendlyDbError(variantsError) };
    }
  }

  revalidateStorefront(slug);
  redirectAfterSave(formData, category_id, brand_id);
}

export async function deleteProductAction(id: string): Promise<{ ok: boolean; message?: string }> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidateStorefront();
  return { ok: true };
}

export type DuplicateProductResult =
  | { ok: true; newId: string }
  | { ok: false; message: string };

export async function duplicateProductAction(id: string): Promise<DuplicateProductResult> {
  const { supabase } = await requireAdmin();

  const { data: original } = await supabase
    .from("products")
    .select("*, product_images(*), product_variants(*)")
    .eq("id", id)
    .maybeSingle();

  if (!original) return { ok: false, message: "Produto não encontrado." };

  let newSlug = `${original.slug}-copia`;
  let attempt = 1;
  while (true) {
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("slug", newSlug)
      .maybeSingle();
    if (!existing) break;
    attempt += 1;
    newSlug = `${original.slug}-copia-${attempt}`;
  }

  const { data: created, error } = await supabase
    .from("products")
    .insert({
      name: `${original.name} (cópia)`,
      slug: newSlug,
      short_description: original.short_description,
      description: original.description,
      video_url: original.video_url,
      tags: original.tags,
      collection: original.collection,
      shipping_note: original.shipping_note,
      exchange_info: original.exchange_info,
      care_instructions: original.care_instructions,
      price: original.price,
      compare_at_price: original.compare_at_price,
      category_id: original.category_id,
      brand_id: original.brand_id,
      manufacturer_ref: original.manufacturer_ref,
      // A copy is the same physical item in the same box, so it ships
      // the same. Leaving these off would produce a duplicate that
      // silently cannot be quoted.
      weight_grams: original.weight_grams,
      length_cm: original.length_cm,
      width_cm: original.width_cm,
      height_cm: original.height_cm,
      attributes: original.attributes,
      badge: null,
      status: "draft",
      featured: false,
      position: original.position,
    })
    .select("id")
    .single();

  if (error || !created) {
    return { ok: false, message: friendlyDbError(error) ?? "Não foi possível duplicar." };
  }

  if (original.product_images.length > 0) {
    await supabase.from("product_images").insert(
      original.product_images.map((img) => ({
        product_id: created.id,
        url: img.url,
        alt: img.alt,
        position: img.position,
      })),
    );
  }

  if (original.product_variants.length > 0) {
    // Stock is not copied — a duplicate is a new listing, not new
    // physical inventory of the original. SKU is rebuilt from the new
    // slug so it can't collide with the original's.
    await supabase.from("product_variants").insert(
      original.product_variants.map((v) => ({
        product_id: created.id,
        color: v.color,
        color_hex: v.color_hex,
        size: v.size,
        sku: buildSku(newSlug, v.color, v.size),
        stock: 0,
        image_url: v.image_url,
      })),
    );
  }

  revalidatePath("/admin/produtos");
  return { ok: true, newId: created.id };
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
