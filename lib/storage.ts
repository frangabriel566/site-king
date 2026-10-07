import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Object storage for uploaded photos — the only file that knows where
 * they physically live.
 *
 * Today: Workers KV (binding IMAGES_KV), with the content type kept in the
 * key's metadata. To move to R2, rewrite these three functions against an
 * R2 binding (`put(key, data, { httpMetadata: { contentType } })`,
 * `get(key)` → `body` + `httpMetadata.contentType`, `delete(key)`) and
 * swap the binding in wrangler.jsonc; callers do not change.
 *
 * KV limits worth knowing (Free plan): 25 MiB per value, 1 000 writes and
 * 100 000 reads per day. Each upload is two writes (photo + thumbnail);
 * the /img route keeps reads down with the edge cache.
 */

export type StoredObject = {
  body: ReadableStream;
  contentType: string;
};

type Metadata = { contentType?: string };

function store(): KVNamespace {
  return getCloudflareContext().env.IMAGES_KV;
}

export async function putObject(
  key: string,
  data: ArrayBuffer,
  contentType: string,
): Promise<void> {
  await store().put(key, data, { metadata: { contentType } satisfies Metadata });
}

export async function getObject(key: string): Promise<StoredObject | null> {
  const { value, metadata } = await store().getWithMetadata<Metadata>(key, { type: "stream" });
  if (!value) return null;
  return { body: value, contentType: metadata?.contentType ?? "application/octet-stream" };
}

export async function deleteObject(key: string): Promise<void> {
  await store().delete(key);
}
