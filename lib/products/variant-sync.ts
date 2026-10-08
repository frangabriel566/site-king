import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { product_variants, order_items } from "@/lib/db/schema";
import type { Db } from "@/lib/db";

/**
 * Saving a product's variants without changing who they are.
 *
 * Until this existed, every save deleted the product's variants and
 * inserted them again with new ids. Orders point at variants
 * (order_items.variant_id, ON DELETE SET NULL), so each save quietly cut
 * every order's link to what it sold — and the stock decrement skips an
 * unlinked line, so confirming those orders stopped taking stock out.
 * Bags in the browser hold variant ids too, and saw their pieces vanish.
 *
 * Now each variant in the form is matched to the row it came from:
 *   1. by id, when the form sent one (a saved variant — renaming its
 *      color keeps the id, so its orders stay with it);
 *   2. else by color + size (a size removed and re-added in the same
 *      session, a draft restored from autosave, the single variant of a
 *      product without options) — archived rows included, so putting back
 *      a color/size that was taken out revives its old id.
 * A matched row is updated in place; an unmatched one is inserted.
 *
 * A saved variant the form no longer has is archived if any order has ever
 * pointed at it (orders keep their link; it disappears from the store and
 * the panel), and deleted if none ever did.
 *
 * Plain module, no server-only import: the planner is pure and the unit
 * and integration tests (tests/variant-sync.*.test.ts) import it directly.
 */

export type ExistingVariant = {
  id: string;
  color: string;
  size: string;
  sku: string | null;
  archived_at: string | null;
};

export type IncomingVariant = {
  /** The saved variant this row was loaded from, if any. */
  id?: string;
  color: string;
  color_hex: string | null;
  size: string;
  sku: string | null;
  stock: number;
  image_url: string | null;
};

type VariantValues = Omit<IncomingVariant, "id">;

export type VariantSyncPlan = {
  /** Matched rows: same id, new values. `restore` = it was archived. */
  updates: { id: string; values: VariantValues; restore: boolean; keyChanged: boolean }[];
  inserts: VariantValues[];
  /** Live rows the form dropped that orders point at. */
  archive: string[];
  /** Live rows the form dropped that no order ever pointed at. */
  remove: string[];
  /** Archived rows (already, or in this save) sitting on a color + size the
   * live variants now need: their key is moved aside so the unique index
   * (product_id, color, size) lets the live one have it. */
  freeKey: string[];
};

const key = (color: string, size: string) => `${color}\u0000${size}`;

export function planVariantSync(
  existing: ExistingVariant[],
  incoming: IncomingVariant[],
  /** Ids of existing variants that some order line points at. */
  soldIds: ReadonlySet<string>,
): VariantSyncPlan {
  const byId = new Map(existing.map((row) => [row.id, row]));
  const matched = new Set<string>();
  const plan: VariantSyncPlan = { updates: [], inserts: [], archive: [], remove: [], freeKey: [] };

  // Ids first, across the whole list, so a key match below can't take a
  // row that a later incoming variant claims by id.
  const claimedById = new Map<IncomingVariant, ExistingVariant>();
  for (const variant of incoming) {
    const row = variant.id ? byId.get(variant.id) : undefined;
    if (row && !matched.has(row.id)) {
      matched.add(row.id);
      claimedById.set(variant, row);
    }
  }

  const byKey = new Map<string, ExistingVariant[]>();
  for (const row of existing) {
    if (matched.has(row.id)) continue;
    const list = byKey.get(key(row.color, row.size)) ?? [];
    list.push(row);
    // A live row wins over an archived one for the same key.
    list.sort((a, b) => Number(Boolean(a.archived_at)) - Number(Boolean(b.archived_at)));
    byKey.set(key(row.color, row.size), list);
  }

  for (const variant of incoming) {
    const values: VariantValues = {
      color: variant.color,
      color_hex: variant.color_hex,
      size: variant.size,
      sku: variant.sku,
      stock: variant.stock,
      image_url: variant.image_url,
    };
    let row = claimedById.get(variant);
    if (!row) {
      const candidates = byKey.get(key(variant.color, variant.size)) ?? [];
      row = candidates.find((candidate) => !matched.has(candidate.id));
      if (row) matched.add(row.id);
    }
    if (row) {
      plan.updates.push({
        id: row.id,
        values,
        restore: Boolean(row.archived_at),
        keyChanged: row.color !== variant.color || row.size !== variant.size || row.sku !== variant.sku,
      });
    } else {
      plan.inserts.push(values);
    }
  }

  for (const row of existing) {
    if (matched.has(row.id) || row.archived_at) continue;
    if (soldIds.has(row.id)) plan.archive.push(row.id);
    else plan.remove.push(row.id);
  }

  // Every archived row left standing (old or new) that blocks a color +
  // size the live variants end up with.
  const liveKeys = new Set(incoming.map((variant) => key(variant.color, variant.size)));
  for (const row of existing) {
    const archivedAfter = (row.archived_at && !matched.has(row.id)) || plan.archive.includes(row.id);
    if (archivedAfter && liveKeys.has(key(row.color, row.size))) plan.freeKey.push(row.id);
  }

  return plan;
}

/** Which of `variantIds` some order line points at — any order, any status. */
export async function soldVariantIds(db: Db, variantIds: string[]): Promise<Set<string>> {
  if (variantIds.length === 0) return new Set();
  const rows = await db
    .selectDistinct({ id: order_items.variant_id })
    .from(order_items)
    .where(and(isNotNull(order_items.variant_id), inArray(order_items.variant_id, variantIds.slice(0, 90))));
  return new Set(rows.flatMap((row) => (row.id ? [row.id] : [])));
}

/**
 * The statements that carry `incoming` into the product's variants, for the
 * product's save batch (one transaction with the product row). Reads the
 * current rows and which of them were sold first.
 *
 * Order matters inside the batch, because of the unique (product_id,
 * color, size) and unique sku:
 *   1. delete the never-sold rows that left;
 *   2. archive the sold rows that left (sku freed);
 *   3. move aside archived rows sitting on a key a live variant needs;
 *   4. matched rows whose color/size/sku change go through a temporary
 *      key first, so two of them can swap without colliding mid-batch;
 *   5. final values for every matched row;
 *   6. new rows.
 */
export async function variantSyncStatements(
  db: Db,
  productId: string,
  incoming: IncomingVariant[],
  now = new Date().toISOString(),
): Promise<BatchItem<"sqlite">[]> {
  const existing = await db
    .select({
      id: product_variants.id,
      color: product_variants.color,
      size: product_variants.size,
      sku: product_variants.sku,
      archived_at: product_variants.archived_at,
    })
    .from(product_variants)
    .where(eq(product_variants.product_id, productId));
  const sold = await soldVariantIds(
    db,
    existing.map((row) => row.id),
  );
  const plan = planVariantSync(existing, incoming, sold);

  const statements: BatchItem<"sqlite">[] = [];
  if (plan.remove.length > 0) {
    // "Never sold" was read before the batch; an order placed in between
    // must not lose its line. Re-checked here, in the transaction: a row
    // that got an order meanwhile is archived instead of deleted.
    const hasOrders = sql`exists (select 1 from ${order_items} where ${order_items.variant_id} = ${product_variants.id})`;
    statements.push(
      db
        .update(product_variants)
        .set({ archived_at: now, sku: null })
        .where(and(inArray(product_variants.id, plan.remove), hasOrders)),
      db
        .delete(product_variants)
        .where(and(inArray(product_variants.id, plan.remove), sql`not ${hasOrders}`)),
    );
  }
  for (const id of plan.archive) {
    statements.push(
      db.update(product_variants).set({ archived_at: now, sku: null }).where(eq(product_variants.id, id)),
    );
  }
  for (const id of plan.freeKey) {
    const row = existing.find((candidate) => candidate.id === id)!;
    statements.push(
      db
        .update(product_variants)
        .set({ color: `${row.color} (arquivada ${id.slice(0, 8)})`, sku: null })
        .where(eq(product_variants.id, id)),
    );
  }
  for (const update of plan.updates) {
    if (!update.keyChanged) continue;
    statements.push(
      db
        .update(product_variants)
        .set({ color: `__moving__:${update.id}`, sku: null })
        .where(eq(product_variants.id, update.id)),
    );
  }
  for (const update of plan.updates) {
    statements.push(
      db
        .update(product_variants)
        .set({ ...update.values, archived_at: null })
        .where(eq(product_variants.id, update.id)),
    );
  }
  for (const values of plan.inserts) {
    statements.push(db.insert(product_variants).values({ ...values, product_id: productId }));
  }
  return statements;
}
