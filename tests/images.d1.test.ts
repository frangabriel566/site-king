import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import { storeLogoIconUrls, thumbnailKey } from "@/lib/image-url";
import { createTestDb } from "./support/d1";

/**
 * Imagens no KV (Etapa 4): one function lets go of images (releaseImages),
 * never one that some other row still uses; deleting a product that was
 * never sold takes its photos with it, a sold one is archived; the cleanup
 * page lists before it deletes and leaves recent uploads alone.
 */

const state = vi.hoisted(() => ({ db: null as unknown as Db, kv: null as unknown as KVNamespace }));

vi.mock("@/lib/db", async () => ({
  getDb: () => state.db,
  schema: await import("@/lib/db/schema"),
}));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: { IMAGES_KV: state.kv }, ctx: { waitUntil: () => undefined } }),
}));
vi.mock("@/lib/auth/guards", () => ({
  getCurrentUser: async () => null,
  requireAdmin: async () => ({ id: "admin-1", email: "dono@kingstore.test", role: "admin" }),
  requireAdminPage: async () => ({ id: "admin-1", email: "dono@kingstore.test", role: "admin" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));

const { releaseImages } = await import("@/lib/media/images");
const { findOrphanUploads, deleteOrphanUploads } = await import("@/lib/media/cleanup");
const productActions = await import("@/lib/actions/products");
const { updateBannerAction } = await import("@/lib/actions/banners");
const { getAllProductsAdmin, getProductBySlug } = await import("@/lib/data/products");

const { products, product_images, product_variants, orders, order_items, banners } = schema;

const DAY = 24 * 60 * 60 * 1000;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ db: state.db, kv: state.kv, dispose } = await createTestDb());
});

afterAll(async () => {
  await dispose?.();
});

beforeEach(async () => {
  await state.db.delete(order_items);
  await state.db.delete(orders);
  await state.db.delete(banners);
  await state.db.delete(products);
  const { keys } = await state.kv.list();
  await Promise.all(keys.map((key) => state.kv.delete(key.name)));
});

/** A photo as /api/upload stores it: full size + thumbnail. `uploadedAt:
 * null` is a file from before dates and sizes were recorded. */
async function upload(
  folder = "products",
  { uploadedAt = new Date(Date.now() - 2 * DAY).toISOString() }: { uploadedAt?: string | null } = {},
) {
  const key = `${folder}/${crypto.randomUUID()}.webp`;
  const meta = (size: number) =>
    uploadedAt === null ? { contentType: "image/webp" } : { contentType: "image/webp", uploadedAt, size };
  await state.kv.put(key, new Uint8Array(1000), { metadata: meta(1000) });
  await state.kv.put(thumbnailKey(key), new Uint8Array(200), { metadata: meta(200) });
  return { key, url: `/img/${key}` };
}

async function stored(key: string) {
  return (await state.kv.get(key)) !== null;
}

async function insertProduct(id: string, slug: string, imageUrls: string[], variantImage?: string) {
  await state.db.insert(products).values({ id, name: `Produto ${slug}`, slug, price: 100, status: "active" });
  if (imageUrls.length > 0) {
    await state.db
      .insert(product_images)
      .values(imageUrls.map((url, position) => ({ product_id: id, url, position })));
  }
  const [variant] = await state.db
    .insert(product_variants)
    .values({ product_id: id, color: "Preto", size: "M", sku: `${slug}-PRETO-M`.toUpperCase(), stock: 3, image_url: variantImage ?? null })
    .returning();
  return variant;
}

function productForm(fields: { name: string; slug: string; images: string[]; variant: { id?: string; image_url: string } }) {
  const data = new FormData();
  data.set("name", fields.name);
  data.set("slug", fields.slug);
  data.set("description", "");
  data.set("price", "100");
  data.set("status", "draft");
  data.set("position", "0");
  data.set("images_json", JSON.stringify(fields.images.map((url, position) => ({ url, alt: "", position }))));
  data.set(
    "variants_json",
    JSON.stringify([
      { ...fields.variant, color: "Preto", size: "M", sku: `${fields.slug}-PRETO-M`.toUpperCase(), stock: 3 },
    ]),
  );
  return data;
}

describe("releaseImages", () => {
  it("apaga foto e miniatura que ninguém usa; a que outro registro usa fica", async () => {
    const shared = await upload();
    const alone = await upload();
    // A duplicated product shares the original's photos.
    await insertProduct("00000000-0000-4000-a000-000000000001", "camisa", [shared.url]);
    await insertProduct("00000000-0000-4000-a000-000000000002", "camisa-copia", [shared.url]);

    const result = await releaseImages([shared.url, alone.url, "https://picsum.photos/200", null]);
    expect(result).toEqual({ released: [alone.key], kept: [shared.key] });
    expect(await stored(alone.key)).toBe(false);
    expect(await stored(thumbnailKey(alone.key))).toBe(false);
    expect(await stored(shared.key)).toBe(true);
    expect(await stored(thumbnailKey(shared.key))).toBe(true);
  });

  it("a logo da loja sai com os dois ícones", async () => {
    const key = `brand/${crypto.randomUUID()}.png`;
    const icons = storeLogoIconUrls(`/img/${key}`)!;
    const files = [key, thumbnailKey(key), icons.icon.slice(5), icons.favicon.slice(5)];
    for (const file of files) await state.kv.put(file, new Uint8Array(10));
    await releaseImages([`/img/${key}`]);
    for (const file of files) expect(await stored(file)).toBe(false);
  });

  it("uma URL absoluta do próprio site num registro também conta como uso", async () => {
    const photo = await upload("banners");
    await state.db
      .insert(banners)
      .values({ image_url: `https://sitekingstore.com.br/img/${photo.key}?v=2`, position: 0 });
    expect((await releaseImages([photo.url])).kept).toEqual([photo.key]);
    expect(await stored(photo.key)).toBe(true);
  });
});

describe("salvar formulários libera o que saiu", () => {
  it("remover uma foto do produto apaga do KV; a foto que a cópia usa fica; foto da cor trocada sai", async () => {
    const shared = await upload();
    const removed = await upload();
    const kept = await upload();
    const oldColor = await upload();
    const newColor = await upload();
    const id = "00000000-0000-4000-a000-000000000011";
    const variant = await insertProduct(id, "jaqueta", [shared.url, removed.url, kept.url], oldColor.url);
    await insertProduct("00000000-0000-4000-a000-000000000012", "jaqueta-copia", [shared.url]);

    await expect(
      productActions.updateProductAction(
        id,
        { status: "idle" },
        productForm({ name: "Jaqueta", slug: "jaqueta", images: [kept.url], variant: { id: variant.id, image_url: newColor.url } }),
      ),
    ).rejects.toThrow("REDIRECT");

    expect(await stored(removed.key)).toBe(false);
    expect(await stored(thumbnailKey(removed.key))).toBe(false);
    expect(await stored(oldColor.key)).toBe(false);
    expect(await stored(shared.key)).toBe(true);
    expect(await stored(kept.key)).toBe(true);
    expect(await stored(newColor.key)).toBe(true);
  });

  it("trocar a imagem do banner apaga a antiga", async () => {
    const before = await upload("banners");
    const after = await upload("banners");
    const [banner] = await state.db.insert(banners).values({ image_url: before.url, position: 0 }).returning();

    const data = new FormData();
    for (const field of ["eyebrow", "headline_line1", "headline_line2", "wordmark", "cta_label", "cta_href", "cutout_url"]) {
      data.set(field, "");
    }
    data.set("image_url", after.url);
    data.set("position", "0");
    await expect(updateBannerAction(banner.id, { status: "idle" }, data)).rejects.toThrow("REDIRECT");

    expect(await stored(before.key)).toBe(false);
    expect(await stored(after.key)).toBe(true);
  });
});

describe("excluir produto", () => {
  it("nunca vendido: sai do banco e as fotos saem do KV (menos a que outro produto usa)", async () => {
    const own = await upload();
    const color = await upload();
    const shared = await upload();
    const id = "00000000-0000-4000-a000-000000000021";
    await insertProduct(id, "bone", [own.url, shared.url], color.url);
    await insertProduct("00000000-0000-4000-a000-000000000022", "bone-copia", [shared.url]);

    const listed = (await getAllProductsAdmin()).find((product) => product.id === id);
    expect(listed?.orderCount).toBe(0);

    const result = await productActions.deleteProductAction(id);
    expect(result).toEqual({ ok: true, message: "Produto excluído, com as fotos." });
    expect(await state.db.select().from(products).where(eq(products.id, id))).toEqual([]);
    expect(await state.db.select().from(product_variants).where(eq(product_variants.product_id, id))).toEqual([]);
    expect(await stored(own.key)).toBe(false);
    expect(await stored(color.key)).toBe(false);
    expect(await stored(shared.key)).toBe(true);
  });

  it("já vendido: arquivado, pedidos continuam ligados, fotos guardadas e o slug fica livre", async () => {
    const photo = await upload();
    const id = "00000000-0000-4000-a000-000000000031";
    const variant = await insertProduct(id, "moletom", [photo.url]);
    await state.db.insert(orders).values({
      id: "order-1",
      order_number: 1,
      subtotal: 100,
      shipping: 0,
      total: 100,
      status: "delivered",
      payment_method: "whatsapp",
    });
    await state.db.insert(order_items).values({
      order_id: "order-1",
      product_id: id,
      variant_id: variant.id,
      name: "Moletom",
      unit_price: 100,
      qty: 1,
    });

    expect((await getAllProductsAdmin()).find((product) => product.id === id)?.orderCount).toBe(1);

    const result = await productActions.deleteProductAction(id);
    expect(result.ok).toBe(true);
    expect(result.message).toContain("arquivado");

    const [row] = await state.db.select().from(products).where(eq(products.id, id));
    expect(row.deleted_at).not.toBeNull();
    expect(row.status).toBe("archived");
    expect(row.slug).not.toBe("moletom");
    const [line] = await state.db.select().from(order_items).where(eq(order_items.order_id, "order-1"));
    expect(line.product_id).toBe(id);
    expect(line.variant_id).toBe(variant.id);
    const [archivedVariant] = await state.db.select().from(product_variants).where(eq(product_variants.id, variant.id));
    expect(archivedVariant.archived_at).not.toBeNull();
    expect(archivedVariant.sku).toBeNull();
    expect(await stored(photo.key)).toBe(true);

    // Out of the panel and the store…
    expect((await getAllProductsAdmin()).some((product) => product.id === id)).toBe(false);
    expect(await getProductBySlug("moletom")).toBeNull();
    // …and its slug and SKU are free for a new product.
    await expect(
      productActions.createProductAction(
        { status: "idle" },
        productForm({ name: "Moletom novo", slug: "moletom", images: [], variant: { image_url: "" } }),
      ),
    ).rejects.toThrow("REDIRECT");
    const [fresh] = await state.db.select().from(products).where(eq(products.slug, "moletom"));
    expect(fresh.id).not.toBe(id);

    // A second delete of the archived one finds nothing.
    expect((await productActions.deleteProductAction(id)).ok).toBe(false);
  });
});

describe("faxina", () => {
  it("lista só o que ninguém usa e tem mais de 24h, com o tamanho; arquivos antigos são medidos", async () => {
    const inUse = await upload();
    const old = await upload("products", { uploadedAt: null });
    const unused = await upload("banners");
    await upload("products", { uploadedAt: new Date(Date.now() - 60_000).toISOString() }); // a minute ago
    await state.kv.put("outra-coisa/arquivo.txt", "x");
    await insertProduct("00000000-0000-4000-a000-000000000041", "tenis", [inUse.url]);

    const report = await findOrphanUploads();
    expect(report.orphans.map((orphan) => orphan.key).sort()).toEqual([old.key, unused.key].sort());
    expect(report.inUse).toBe(1);
    expect(report.recent).toBe(1);
    expect(report.foreign).toBe(1);
    // 1 000 + 200 bytes each: recorded for one, measured for the old one.
    expect(report.totalBytes).toBe(2400);
    expect(report.unmeasured).toBe(0);
    const oldEntry = report.orphans.find((orphan) => orphan.key === old.key)!;
    expect(oldEntry.uploadedAt).toBeNull();
    expect(oldEntry.files.sort()).toEqual([old.key, thumbnailKey(old.key)].sort());

    // Nothing was deleted by the analysis.
    expect(await stored(old.key)).toBe(true);
    expect(await stored(unused.key)).toBe(true);
  });

  it("apaga depois de conferir de novo: o que voltou a ser usado fica", async () => {
    const orphan = await upload();
    const reused = await upload();
    const { orphans } = await findOrphanUploads();
    expect(orphans).toHaveLength(2);

    // Between the analysis and the confirmation, a product starts using one.
    await insertProduct("00000000-0000-4000-a000-000000000051", "regata", [reused.url]);
    const result = await deleteOrphanUploads(orphans.map((entry) => entry.key));
    expect(result).toEqual({ deleted: 1, nowInUse: 1, error: null });
    expect(await stored(orphan.key)).toBe(false);
    expect(await stored(thumbnailKey(orphan.key))).toBe(false);
    expect(await stored(reused.key)).toBe(true);

    // Keys that are not uploads of this site are ignored.
    expect(await deleteOrphanUploads(["outra-coisa/arquivo.txt", "../x"])).toEqual({
      deleted: 0,
      nowInUse: 0,
      error: null,
    });
  });
});
