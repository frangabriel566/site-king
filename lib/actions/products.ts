"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, ne } from "drizzle-orm";
import { collectPublishIssues, productSchema } from "@/lib/validations/product";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb, schema, type Db } from "@/lib/db";
import { insertChunks, runBatch } from "@/lib/db/batch";
import { isUniqueViolation } from "@/lib/db/errors";
import { roundMoney } from "@/lib/money";
import { searchTextFor } from "@/lib/catalog/search-index";

export type ActionResult = { status: "idle" | "error" | "success"; message?: string };

const { products, product_images, product_variants } = schema;

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

type ParsedProduct = NonNullable<ReturnType<typeof parseFormData>["data"]>;

/** The products row for a parsed form — shared by create and update. */
function toProductRow(data: ParsedProduct, searchText: string) {
  return {
    name: data.name,
    slug: data.slug,
    short_description: data.short_description || null,
    description: data.description || null,
    video_url: data.video_url || null,
    tags: data.tags.length > 0 ? data.tags : null,
    collection: data.collection || null,
    shipping_note: data.shipping_note || null,
    exchange_info: data.exchange_info || null,
    care_instructions: data.care_instructions || null,
    price: roundMoney(data.price),
    compare_at_price: data.compare_at_price != null ? roundMoney(data.compare_at_price) : null,
    category_id: data.category_id ?? null,
    brand_id: data.brand_id ?? null,
    manufacturer_ref: data.manufacturer_ref || null,
    weight_grams: data.weight_grams ?? null,
    length_cm: data.length_cm ?? null,
    width_cm: data.width_cm ?? null,
    height_cm: data.height_cm ?? null,
    attributes: data.attributes ?? null,
    badge: data.badge ?? null,
    status: data.status,
    featured: data.featured,
    position: data.position,
    search_text: searchText,
  };
}

function childRows(productId: string, data: ParsedProduct) {
  return {
    images: data.images.map((img, index) => ({
      product_id: productId,
      url: img.url,
      alt: img.alt || null,
      position: index,
    })),
    variants: data.variants.map((v) => ({
      product_id: productId,
      color: v.color,
      color_hex: v.color_hex || null,
      size: v.size,
      sku: v.sku || null,
      stock: v.stock,
      image_url: v.image_url || null,
    })),
  };
}

/**
 * The two unique values an operator types and can collide on — checked
 * before writing, because SQLite's error names the column but not the
 * value, and "which SKU?" is the whole question.
 */
async function findConflict(
  db: Db,
  data: ParsedProduct,
  productId?: string,
): Promise<string | null> {
  const slugTaken = await db.query.products.findFirst({
    columns: { id: true },
    where: and(eq(products.slug, data.slug), productId ? ne(products.id, productId) : undefined),
  });
  if (slugTaken) return "Já existe um produto com esse slug.";

  const skus = data.variants.map((v) => v.sku).filter((sku): sku is string => Boolean(sku));
  const repeated = skus.find((sku, i) => skus.indexOf(sku) !== i);
  if (repeated) return `O SKU "${repeated}" aparece em mais de uma variação.`;
  if (skus.length > 0) {
    const [taken] = await db
      .select({ sku: product_variants.sku })
      .from(product_variants)
      .where(
        and(
          inArray(product_variants.sku, skus.slice(0, 90)),
          productId ? ne(product_variants.product_id, productId) : undefined,
        ),
      )
      .limit(1);
    if (taken?.sku) return `O SKU "${taken.sku}" já está em uso por outra variação.`;
  }
  return null;
}

function friendlyDbError(error: unknown): string {
  if (isUniqueViolation(error, "products.slug")) return "Já existe um produto com esse slug.";
  if (isUniqueViolation(error, "product_variants.sku")) {
    return "Um dos SKUs já está em uso por outra variação.";
  }
  if (isUniqueViolation(error, "product_variants.product_id")) {
    return "Há duas variações com a mesma cor e o mesmo tamanho.";
  }
  console.error("[products]", error);
  return "Não foi possível salvar o produto.";
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
  const data = parsed.data;

  // Defense in depth: the client already blocks publishing with missing
  // fields, but the server must not trust that — this is the real gate.
  const publishIssues = collectPublishIssues(data);
  if (publishIssues.length > 0) {
    return { status: "error", message: publishIssues[0].message };
  }

  await requireAdmin();
  const db = getDb();

  const conflict = await findConflict(db, data);
  if (conflict) return { status: "error", message: conflict };

  const productId = crypto.randomUUID();
  const { images, variants } = childRows(productId, data);
  try {
    // Product, photos and variants in one transaction: a variant that fails
    // no longer leaves a half-saved product behind.
    await runBatch(db, [
      db.insert(products).values({ id: productId, ...toProductRow(data, await searchTextFor(db, data)) }),
      ...insertChunks(db, product_images, images),
      ...insertChunks(db, product_variants, variants),
    ]);
  } catch (error) {
    return { status: "error", message: friendlyDbError(error) };
  }

  revalidateStorefront(data.slug);
  redirectAfterSave(formData, data.category_id, data.brand_id);
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
  const data = parsed.data;

  const publishIssues = collectPublishIssues(data);
  if (publishIssues.length > 0) {
    return { status: "error", message: publishIssues[0].message };
  }

  await requireAdmin();
  const db = getDb();

  const conflict = await findConflict(db, data, id);
  if (conflict) return { status: "error", message: conflict };

  const { images, variants } = childRows(id, data);
  try {
    // Photos and variants are replaced wholesale, as before — now in the
    // same transaction as the product row.
    await runBatch(db, [
      db.update(products).set(toProductRow(data, await searchTextFor(db, data))).where(eq(products.id, id)),
      db.delete(product_images).where(eq(product_images.product_id, id)),
      ...insertChunks(db, product_images, images),
      db.delete(product_variants).where(eq(product_variants.product_id, id)),
      ...insertChunks(db, product_variants, variants),
    ]);
  } catch (error) {
    return { status: "error", message: friendlyDbError(error) };
  }

  revalidateStorefront(data.slug);
  redirectAfterSave(formData, data.category_id, data.brand_id);
}

export async function deleteProductAction(id: string): Promise<{ ok: boolean; message?: string }> {
  await requireAdmin();
  // Photos and variants go with it (ON DELETE CASCADE); past orders keep
  // their snapshot and lose only the link.
  await getDb().delete(products).where(eq(products.id, id));
  revalidateStorefront();
  return { ok: true };
}

export type DuplicateProductResult =
  | { ok: true; newId: string }
  | { ok: false; message: string };

export async function duplicateProductAction(id: string): Promise<DuplicateProductResult> {
  await requireAdmin();
  const db = getDb();

  const original = await db.query.products.findFirst({
    where: eq(products.id, id),
    with: { product_images: true, product_variants: true },
  });
  if (!original) return { ok: false, message: "Produto não encontrado." };

  let newSlug = `${original.slug}-copia`;
  let attempt = 1;
  while (
    await db.query.products.findFirst({ columns: { id: true }, where: eq(products.slug, newSlug) })
  ) {
    attempt += 1;
    newSlug = `${original.slug}-copia-${attempt}`;
  }

  const newId = crypto.randomUUID();
  const now = new Date().toISOString();
  const {
    product_images: originalImages,
    product_variants: originalVariants,
    ...fields
  } = original;

  try {
    await runBatch(db, [
      db.insert(products).values({
        ...fields,
        id: newId,
        created_at: now,
        updated_at: now,
        name: `${original.name} (cópia)`,
        slug: newSlug,
        // A copy is the same physical item in the same box, so weight and
        // measurements carry over; placement and publication do not.
        badge: null,
        status: "draft",
        featured: false,
      }),
      ...insertChunks(
        db,
        product_images,
        originalImages.map((img) => ({
          product_id: newId,
          url: img.url,
          alt: img.alt,
          position: img.position,
        })),
      ),
      // Stock is not copied — a duplicate is a new listing, not new
      // physical inventory of the original. SKU is rebuilt from the new
      // slug so it can't collide with the original's.
      ...insertChunks(
        db,
        product_variants,
        originalVariants.map((v) => ({
          product_id: newId,
          color: v.color,
          color_hex: v.color_hex,
          size: v.size,
          sku: buildSku(newSlug, v.color, v.size) || null,
          stock: 0,
          image_url: v.image_url,
        })),
      ),
    ]);
  } catch (error) {
    return { ok: false, message: friendlyDbError(error) };
  }

  revalidatePath("/admin/produtos");
  return { ok: true, newId };
}

export async function updateVariantStockAction(
  variantId: string,
  stock: number,
): Promise<{ ok: boolean; message?: string }> {
  if (!Number.isInteger(stock) || stock < 0) {
    return { ok: false, message: "Estoque não pode ser negativo." };
  }
  await requireAdmin();
  const updated = await getDb()
    .update(product_variants)
    .set({ stock })
    .where(eq(product_variants.id, variantId))
    .returning({ id: product_variants.id });
  if (updated.length === 0) return { ok: false, message: "Variação não encontrada." };
  revalidatePath("/admin/estoque");
  revalidatePath("/admin/produtos");
  revalidatePath("/colecao");
  return { ok: true };
}
