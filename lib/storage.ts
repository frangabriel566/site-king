import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Object storage for uploaded photos — the only file that knows where
 * they physically live.
 *
 * Today: Workers KV (binding IMAGES_KV), with the content type, upload
 * time and size kept in the key's metadata. To move to R2, rewrite these
 * functions against an R2 binding (`put(key, data, { httpMetadata:
 * { contentType }, customMetadata })`, `get(key)` → `body` +
 * `httpMetadata.contentType`, `delete(key)`, `list({ prefix, cursor })`,
 * which also gives each object's size) and swap the binding in
 * wrangler.jsonc; callers do not change.
 *
 * KV limits worth knowing (Free plan): 25 MiB per value, 1 000 writes,
 * 1 000 deletes, 1 000 lists and 100 000 reads per day, and 1 000
 * operations per request. Each upload is two writes (photo + thumbnail);
 * the /img route keeps reads down with the edge cache.
 */

export type StoredObject = {
  body: ReadableStream;
  contentType: string;
};

/** `uploadedAt` and `size` exist on uploads made since the image cleanup
 * (Admin → Faxina de imagens) arrived; older files only have the type. */
export type ObjectMetadata = { contentType?: string; uploadedAt?: string; size?: number };

export type ListedObject = { key: string; metadata: ObjectMetadata | null };

function store(): KVNamespace {
  return getCloudflareContext().env.IMAGES_KV;
}

export async function putObject(
  key: string,
  data: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const metadata: ObjectMetadata = {
    contentType,
    uploadedAt: new Date().toISOString(),
    size: data.byteLength,
  };
  await store().put(key, data, { metadata });
}

export async function getObject(key: string): Promise<StoredObject | null> {
  const { value, metadata } = await store().getWithMetadata<ObjectMetadata>(key, { type: "stream" });
  if (!value) return null;
  return { body: value, contentType: metadata?.contentType ?? "application/octet-stream" };
}

export async function deleteObject(key: string): Promise<void> {
  await store().delete(key);
}

/** One page (up to 1 000) of stored files, with their metadata but not
 * their bytes. `cursor` is null on the last page. */
export async function listObjects(
  options: { prefix?: string; cursor?: string | null } = {},
): Promise<{ objects: ListedObject[]; cursor: string | null }> {
  const page = await store().list<ObjectMetadata>({
    prefix: options.prefix,
    cursor: options.cursor ?? undefined,
  });
  return {
    objects: page.keys.map((entry) => ({ key: entry.name, metadata: entry.metadata ?? null })),
    cursor: page.list_complete ? null : page.cursor,
  };
}

/** Size in bytes of a file uploaded before sizes were recorded — costs a
 * read of the whole file. Null when it is gone. */
export async function measureObject(key: string): Promise<number | null> {
  const value = await store().get(key, { type: "arrayBuffer" });
  return value ? value.byteLength : null;
}
