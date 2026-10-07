import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getObject } from "@/lib/storage";
import { isImageKey, thumbnailKey } from "@/lib/image-url";

/**
 * Serves uploaded photos: /img/<folder>/<uuid>.webp, plus `?v=sm` for the
 * thumbnail (what lib/image-loader.ts asks for at card sizes).
 *
 * Every upload gets a fresh UUID key and is never overwritten, so a URL's
 * bytes never change: a year of `immutable` caching is safe, both in the
 * browser and in Cloudflare's edge cache, which this route fills so a
 * popular photo stops costing a KV read per view. (The edge cache only
 * works on a custom domain — on *.workers.dev `cache.put` is a no-op.)
 */

const IMMUTABLE = "public, max-age=31536000, immutable";

function edgeCache(): Cache | null {
  // Workers-only; absent under `next dev`, where this runs in Node.
  return (globalThis as { caches?: { default?: Cache } }).caches?.default ?? null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const key = (await params).key.join("/");
  if (!isImageKey(key)) return new Response("Not found", { status: 404 });

  const wantsThumbnail = new URL(request.url).searchParams.get("v") === "sm";
  const objectKey = wantsThumbnail ? thumbnailKey(key) : key;

  // One cache entry per stored object, whatever other query params the
  // request carried (SafeImage's `retry=1`, for one).
  const cacheKey = new Request(new URL(`/img/${objectKey}`, request.url).toString());
  const cache = edgeCache();
  const cached = await cache?.match(cacheKey);
  if (cached) return cached;

  // A photo uploaded before thumbnails existed (or a lost thumbnail write)
  // still shows — at full size.
  const object = (await getObject(objectKey)) ?? (wantsThumbnail ? await getObject(key) : null);
  if (!object) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "public, max-age=60" },
    });
  }

  const response = new Response(object.body, {
    headers: {
      "Content-Type": object.contentType,
      "Cache-Control": IMMUTABLE,
      "X-Content-Type-Options": "nosniff",
    },
  });

  if (cache) {
    getCloudflareContext().ctx.waitUntil(cache.put(cacheKey, response.clone()));
  }
  return response;
}
