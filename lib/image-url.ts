/**
 * Where uploaded photos live, as URLs. Shared by the browser (uploads,
 * previews) and the server (the /img route, deletes) — no bindings here.
 *
 * Every upload is stored twice under related keys:
 *   products/<uuid>.webp      full size (≤1600px, ≤~500 KB)
 *   products/<uuid>.sm.webp   thumbnail (640px wide) for cards and lists
 * The database only ever stores the full-size URL; the thumbnail key is
 * derived from it.
 */

export const IMAGE_ROUTE_PREFIX = "/img/";

export const UPLOAD_FOLDERS = ["products", "banners", "brand", "categories"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

const KEY_PATTERN = /^(products|banners|brand|categories)\/[0-9a-f-]{36}(\.sm)?\.(webp|jpg|png)$/;

export function isImageKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

export function imageUrlForKey(key: string): string {
  return `${IMAGE_ROUTE_PREFIX}${key}`;
}

/** `null` for anything that is not one of our uploads (seed photos on
 * picsum.photos, a pasted external URL). */
export function keyFromImageUrl(url: string): string | null {
  const path = url.split(/[?#]/)[0];
  if (!path.startsWith(IMAGE_ROUTE_PREFIX)) return null;
  const key = path.slice(IMAGE_ROUTE_PREFIX.length);
  return isImageKey(key) ? key : null;
}

export function thumbnailKey(key: string): string {
  return key.replace(/(\.sm)?\.(webp|jpg|png)$/, ".sm.$2");
}
