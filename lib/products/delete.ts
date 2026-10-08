import "server-only";
import { and, countDistinct, eq, inArray, isNotNull, isNull, notExists, or, sql } from "drizzle-orm";
import { getDb, schema, type Db } from "@/lib/db";
import { runBatch } from "@/lib/db/batch";
import { releaseImages } from "@/lib/media/images";

/**
 * Deleting a product from the panel.
 *
 * Never sold (no order line points at it, any status): deleted for real —
 * photos, variants and shelves go with it (ON DELETE CASCADE) — and its
 * images are released from KV.
 *
 * Sold: archived instead, so every order keeps its link and nothing in the
 * order history changes. The row gets `deleted_at`, status "archived" and
 * its slug moved aside (so a new product can take it); its variants are
 * archived like the ones taken out of a product (sku freed), and it leaves
 * its shelves, banners and feedbacks — what a real delete does through the
 * foreign keys. The photos stay in KV: the row still points at them, which
 * also keeps a manual restore possible.
 */

const { products, product_images, product_variants, product_sections, order_items, banners, feedbacks } =
  schema;

export type DeleteProductOutcome = "deleted" | "archived" | "not_found";

/** An order line for this product — by the product, or by one of its
 * variants (a line whose product link was lost still counts). */
function soldLine(db: Db, productId: string) {
  return or(
    eq(order_items.product_id, productId),
    inArray(
      order_items.variant_id,
      db.select({ id: product_variants.id }).from(product_variants).where(eq(product_variants.product_id, productId)),
    ),
  );
}

/** How many orders (any status) have this product on a line. */
export async function productOrderCount(db: Db, productId: string): Promise<number> {
  const [row] = await db
    .select({ orders: countDistinct(order_items.order_id) })
    .from(order_items)
    .where(soldLine(db, productId));
  return row?.orders ?? 0;
}

/** Order counts for every product that has any, for the panel's list. */
export async function orderCountsByProduct(db: Db): Promise<Map<string, number>> {
  const rows = await db
    .select({ productId: order_items.product_id, orders: countDistinct(order_items.order_id) })
    .from(order_items)
    .where(isNotNull(order_items.product_id))
    .groupBy(order_items.product_id);
  return new Map(rows.flatMap((row) => (row.productId ? [[row.productId, row.orders]] : [])));
}

/** Every image URL a product points at: gallery, variants (archived ones
 * too) and the video field. */
export async function productImageUrls(db: Db, productId: string): Promise<string[]> {
  const [images, variants, [product]] = await runBatch(db, [
    db.select({ url: product_images.url }).from(product_images).where(eq(product_images.product_id, productId)),
    db
      .select({ url: product_variants.image_url })
      .from(product_variants)
      .where(eq(product_variants.product_id, productId)),
    db.select({ url: products.video_url }).from(products).where(eq(products.id, productId)),
  ]) as [{ url: string | null }[], { url: string | null }[], { url: string | null }[]];
  return [...images, ...variants, ...(product ? [product] : [])].flatMap((row) => (row.url ? [row.url] : []));
}

async function archiveProduct(db: Db, productId: string, now: string) {
  await runBatch(db, [
    db
      .update(products)
      .set({
        deleted_at: now,
        status: "archived",
        featured: false,
        slug: sql`${products.slug} || '--excluido-' || substr(${products.id}, 1, 8)`,
        updated_at: now,
      })
      .where(and(eq(products.id, productId), isNull(products.deleted_at))),
    db
      .update(product_variants)
      .set({ archived_at: now, sku: null })
      .where(and(eq(product_variants.product_id, productId), isNull(product_variants.archived_at))),
    db.delete(product_sections).where(eq(product_sections.product_id, productId)),
    db.update(banners).set({ featured_product_id: null }).where(eq(banners.featured_product_id, productId)),
    db.update(feedbacks).set({ product_id: null }).where(eq(feedbacks.product_id, productId)),
  ]);
}

export async function deleteProduct(
  productId: string,
  now = new Date().toISOString(),
): Promise<DeleteProductOutcome> {
  const db = getDb();
  const existing = await db.query.products.findFirst({
    columns: { id: true },
    where: and(eq(products.id, productId), isNull(products.deleted_at)),
  });
  if (!existing) return "not_found";

  if ((await productOrderCount(db, productId)) === 0) {
    const urls = await productImageUrls(db, productId);
    // "Never sold" was read above; an order placed in between must not
    // lose its line, so the delete checks again in the same statement.
    const removed = await db
      .delete(products)
      .where(
        and(
          eq(products.id, productId),
          notExists(db.select({ id: order_items.id }).from(order_items).where(soldLine(db, productId))),
        ),
      )
      .returning({ id: products.id });
    if (removed.length > 0) {
      await releaseImages(urls);
      return "deleted";
    }
  }

  await archiveProduct(db, productId, now);
  return "archived";
}
