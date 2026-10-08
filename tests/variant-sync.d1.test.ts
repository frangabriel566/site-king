import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import { runBatch } from "@/lib/db/batch";
import { variantSyncStatements, type IncomingVariant } from "@/lib/products/variant-sync";
import { createTestDb } from "./support/d1";

/**
 * Saving a product must not change who its variants are: same ids, and
 * every order line still pointing at what it sold. Runs the real save
 * statements (the ones updateProductAction batches) against a real D1.
 */

const { products, product_variants, orders, order_items } = schema;

const PRODUCT = "aaaaaaaa-0000-4000-a000-000000000001";
const V = {
  pretoM: "bbbbbbbb-0000-4000-a000-000000000001",
  pretoG: "bbbbbbbb-0000-4000-a000-000000000002",
  brancoM: "bbbbbbbb-0000-4000-a000-000000000003",
  brancoG: "bbbbbbbb-0000-4000-a000-000000000004",
};

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ db, dispose } = await createTestDb());

  await runBatch(db, [
    db.insert(products).values({ id: PRODUCT, name: "Moletom", slug: "moletom", price: 100, status: "active" }),
    db.insert(product_variants).values([
      { id: V.pretoM, product_id: PRODUCT, color: "Preto", size: "M", sku: "MOL-PRETO-M", stock: 5 },
      { id: V.pretoG, product_id: PRODUCT, color: "Preto", size: "G", sku: "MOL-PRETO-G", stock: 2 },
      { id: V.brancoM, product_id: PRODUCT, color: "Branco", size: "M", sku: "MOL-BRANCO-M", stock: 1 },
      { id: V.brancoG, product_id: PRODUCT, color: "Branco", size: "G", sku: "MOL-BRANCO-G", stock: 0 },
    ]),
    // A pending order (stock still to be taken out) and a delivered one.
    db.insert(orders).values([
      { id: "cccccccc-0000-4000-a000-000000000001", order_number: 1, status: "aguardando_whatsapp", code: "KS0001" },
      { id: "cccccccc-0000-4000-a000-000000000002", order_number: 2, status: "delivered" },
    ]),
    db.insert(order_items).values([
      { order_id: "cccccccc-0000-4000-a000-000000000001", product_id: PRODUCT, variant_id: V.pretoM, name: "Moletom", color: "Preto", size: "M", unit_price: 100, qty: 1 },
      { order_id: "cccccccc-0000-4000-a000-000000000001", product_id: PRODUCT, variant_id: V.pretoG, name: "Moletom", color: "Preto", size: "G", unit_price: 100, qty: 1 },
      { order_id: "cccccccc-0000-4000-a000-000000000002", product_id: PRODUCT, variant_id: V.brancoM, name: "Moletom", color: "Branco", size: "M", unit_price: 100, qty: 1 },
    ]),
  ]);
});

afterAll(async () => {
  await dispose?.();
});

const variantsOf = () =>
  db.select().from(product_variants).where(eq(product_variants.product_id, PRODUCT));
const orderLinks = async () =>
  (await db.select({ variant_id: order_items.variant_id }).from(order_items)).map((r) => r.variant_id);

async function save(variants: IncomingVariant[]) {
  await runBatch(db, await variantSyncStatements(db, PRODUCT, variants));
}

const v = (color: string, size: string, stock: number, id?: string, sku?: string): IncomingVariant => ({
  id,
  color,
  size,
  color_hex: null,
  sku: sku ?? `MOL-${color}-${size}`.toUpperCase().replace(/\s+/g, "-"),
  stock,
  image_url: null,
});

describe("saving a product's variants", () => {
  it("keeps every id and every order link on a plain re-save with new stock", async () => {
    await save([
      v("Preto", "M", 7, V.pretoM, "MOL-PRETO-M"),
      v("Preto", "G", 2, V.pretoG, "MOL-PRETO-G"),
      v("Branco", "M", 1, V.brancoM, "MOL-BRANCO-M"),
      v("Branco", "G", 3, V.brancoG, "MOL-BRANCO-G"),
    ]);
    const rows = await variantsOf();
    expect(rows.map((r) => r.id).sort()).toEqual(Object.values(V).sort());
    expect(rows.find((r) => r.id === V.pretoM)?.stock).toBe(7);
    expect(await orderLinks()).not.toContain(null);
  });

  it("renames a color without changing its id, adds a size, archives the sold and deletes the unsold", async () => {
    await save([
      v("Preto", "M", 7, V.pretoM, "MOL-PRETO-M"),
      // Branco → Branco Gelo, same id (its delivered order stays with it).
      v("Branco Gelo", "M", 1, V.brancoM, "MOL-BRANCO-GELO-M"),
      v("Preto", "GG", 4),
      // Preto/G (pending order) and Branco/G (never sold) are gone.
    ]);
    const rows = await variantsOf();
    const byId = new Map(rows.map((r) => [r.id, r]));

    expect(byId.get(V.pretoM)?.archived_at).toBeNull();
    expect(byId.get(V.brancoM)?.color).toBe("Branco Gelo");
    expect(byId.get(V.pretoG)?.archived_at).not.toBeNull();
    expect(byId.get(V.pretoG)?.sku).toBeNull();
    expect(byId.has(V.brancoG)).toBe(false);
    expect(rows.filter((r) => r.color === "Preto" && r.size === "GG")).toHaveLength(1);

    const links = await orderLinks();
    expect(links).not.toContain(null);
    expect(links.sort()).toEqual([V.pretoM, V.pretoG, V.brancoM].sort());
  });

  it("brings an archived variant back with its old id when its color + size returns", async () => {
    await save([
      v("Preto", "M", 7, V.pretoM, "MOL-PRETO-M"),
      v("Branco Gelo", "M", 1, V.brancoM, "MOL-BRANCO-GELO-M"),
      v("Preto", "GG", 4),
      v("Preto", "G", 5),
    ]);
    const back = (await variantsOf()).find((r) => r.id === V.pretoG);
    expect(back).toMatchObject({ archived_at: null, stock: 5, color: "Preto", size: "G" });
  });

  it("swaps two colors in one save without colliding, ids kept", async () => {
    await save([
      v("Branco Gelo", "M", 7, V.pretoM, "MOL-SWAP-1"),
      v("Preto", "M", 1, V.brancoM, "MOL-SWAP-2"),
      v("Preto", "GG", 4),
      v("Preto", "G", 5, V.pretoG),
    ]);
    const byId = new Map((await variantsOf()).map((r) => [r.id, r]));
    expect(byId.get(V.pretoM)?.color).toBe("Branco Gelo");
    expect(byId.get(V.brancoM)?.color).toBe("Preto");
    expect(await orderLinks()).not.toContain(null);
  });

  it("never lets a save null an order line", async () => {
    // Everything removed at once: the sold rows are archived, not deleted.
    await save([v("Azul", "U", 1)]);
    expect(await orderLinks()).not.toContain(null);
    const live = (await variantsOf()).filter((r) => !r.archived_at);
    expect(live.map((r) => r.color)).toEqual(["Azul"]);
  });
});
