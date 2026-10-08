import "server-only";
import { like, or, sql } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import { getDb, schema, type Db } from "@/lib/db";
import { runBatch } from "@/lib/db/batch";
import { deleteObject } from "@/lib/storage";
import { keyFromImageUrl, storedKeysFor, uploadKeyFor, uploadKeysIn } from "@/lib/image-url";

/**
 * Taking uploads out of Workers KV once nothing uses them — the one way
 * every form, delete and the cleanup page do it.
 *
 * A file is only deleted after checking that no row anywhere points at it:
 * a duplicated product shares its photos with the original, so "this
 * product stopped using it" is not "nobody uses it". The database change
 * always comes first; a KV delete that fails afterwards is logged and left
 * for the cleanup page, never undone in the database.
 */

/** Every column that can hold one of our image URLs. A new one goes here
 * too, or the cleanup page would see its files as unused. */
const IMAGE_COLUMNS: { table: SQLiteTable; column: SQLiteColumn }[] = [
  { table: schema.products, column: schema.products.video_url },
  { table: schema.product_images, column: schema.product_images.url },
  // Archived variants included: they keep their photo for their orders.
  { table: schema.product_variants, column: schema.product_variants.image_url },
  { table: schema.categories, column: schema.categories.image_url },
  { table: schema.brands, column: schema.brands.logo_url },
  { table: schema.banners, column: schema.banners.image_url },
  { table: schema.banners, column: schema.banners.cutout_url },
  { table: schema.site_settings, column: schema.site_settings.logo_url },
  { table: schema.feedback_images, column: schema.feedback_images.url },
  { table: schema.user, column: schema.user.image },
];

// D1 takes at most 100 bound parameters per statement; one per key.
const KEYS_PER_STATEMENT = 50;

/** Which of `keys` (upload keys, as uploadKeyFor gives them) some row
 * still points at — one round trip per 50 keys. */
export async function uploadKeysInUse(db: Db, keys: string[]): Promise<Set<string>> {
  const used = new Set<string>();
  for (let start = 0; start < keys.length; start += KEYS_PER_STATEMENT) {
    const chunk = keys.slice(start, start + KEYS_PER_STATEMENT);
    const results = (await runBatch(
      db,
      IMAGE_COLUMNS.map(({ table, column }) =>
        db
          .select({ value: column })
          .from(table)
          // instr, not LIKE: D1 refuses LIKE patterns over 50 bytes, and
          // "%/img/products/<uuid>.webp%" is 57.
          .where(or(...chunk.map((key) => sql`instr(lower(${column}), ${`/img/${key}`}) > 0`))),
      ),
    )) as { value: unknown }[][];
    for (const rows of results) {
      for (const row of rows) {
        const value = String(row.value ?? "");
        for (const key of uploadKeysIn(value)) used.add(key);
        // The query ignores case and uploadKeysIn does not: whatever the
        // query matched counts as in use.
        const lower = value.toLowerCase();
        for (const key of chunk) if (lower.includes(`/img/${key}`)) used.add(key);
      }
    }
  }
  return used;
}

/** Every upload any row points at — what the cleanup page compares the
 * whole of KV against. */
export async function allUploadKeysInUse(db: Db): Promise<Set<string>> {
  const results = (await runBatch(
    db,
    IMAGE_COLUMNS.map(({ table, column }) =>
      db.select({ value: column }).from(table).where(like(column, "%/img/%")),
    ),
  )) as { value: unknown }[][];
  const used = new Set<string>();
  for (const rows of results) {
    for (const row of rows) {
      for (const key of uploadKeysIn(String(row.value ?? ""))) used.add(key);
    }
  }
  return used;
}

export type ReleaseResult = {
  /** Upload keys whose files were deleted (or were already gone). */
  released: string[];
  /** Upload keys left alone because another row still uses them. */
  kept: string[];
};

/**
 * Lets go of images a save or a delete stopped using: those that are our
 * uploads and that no row points at anymore lose their files — photo,
 * thumbnail and, for the store logo, its icons. Anything else (seed photos
 * on other hosts, a file still in use) is left alone.
 *
 * Call it after the database change. It never throws: the change it
 * follows has already happened, and a file left behind is only wasted
 * space, which the cleanup page finds later.
 */
export async function releaseImages(
  urls: Iterable<string | null | undefined>,
): Promise<ReleaseResult> {
  const keys = new Set<string>();
  for (const url of urls) {
    const key = url ? keyFromImageUrl(url) : null;
    if (key) keys.add(uploadKeyFor(key));
  }
  if (keys.size === 0) return { released: [], kept: [] };

  let used: Set<string>;
  try {
    used = await uploadKeysInUse(getDb(), [...keys]);
  } catch (error) {
    console.error("[media] não foi possível conferir o uso das imagens; nada foi apagado", error);
    return { released: [], kept: [...keys] };
  }

  const released = [...keys].filter((key) => !used.has(key));
  const files = released.flatMap(storedKeysFor);
  const results = await Promise.allSettled(files.map((file) => deleteObject(file)));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`[media] falha ao apagar ${files[index]} do KV`, result.reason);
    }
  });
  return { released, kept: [...keys].filter((key) => used.has(key)) };
}

/** URLs that were in `before` and are not in `after` — what a save
 * stopped using. */
export function removedUrls(
  before: Iterable<string | null | undefined>,
  after: Iterable<string | null | undefined>,
): string[] {
  const kept = new Set(Array.from(after).filter(Boolean));
  return Array.from(new Set(Array.from(before))).filter(
    (url): url is string => Boolean(url) && !kept.has(url as string),
  );
}
