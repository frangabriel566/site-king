/**
 * Where uploaded photos live, as URLs. Shared by the browser (uploads,
 * previews) and the server (the /img route, deletes) — no bindings here.
 *
 * Every upload is stored twice under related keys:
 *   products/<uuid>.webp      full size (≤1600px, ≤~500 KB)
 *   products/<uuid>.sm.webp   thumbnail (640px wide) for cards and lists
 * The database only ever stores the full-size URL; the thumbnail key is
 * derived from it.
 *
 * The store logo (Configurações) is the one upload stored as PNG, and it
 * carries two more files, its icons:
 *   brand/<uuid>.png          the logo (transparent, ≤240px tall)
 *   brand/<uuid>.icon.png     512px square: home screen, apple-touch-icon
 *   brand/<uuid>.favicon.png  48px square: the browser tab
 */

export const IMAGE_ROUTE_PREFIX = "/img/";

export const UPLOAD_FOLDERS = ["products", "banners", "brand", "categories", "feedbacks"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

const KEY_PATTERN =
  /^(products|banners|brand|categories|feedbacks)\/[0-9a-f-]{36}(\.sm|\.icon|\.favicon)?\.(webp|jpg|png)$/;
const STORE_LOGO_KEY = /^brand\/[0-9a-f-]{36}\.png$/;

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

/**
 * Uploads since nov/2026 end their name in the first 12 hex digits of the
 * original file's SHA-256 (`<24 random chars><12 hash digits>`, still 36
 * chars), so the same photo uploaded into two slots — the cover and a
 * color's photo, say — gets two keys (deleting one never breaks the other)
 * that can still be told apart as the same picture. Older uploads end in
 * random digits, which simply never match anything.
 */
export function uploadKeyWithFingerprint(folder: string, extension: string, sourceHash?: string | null): string {
  const random = crypto.randomUUID();
  const tail = sourceHash && /^[0-9a-f]{64}$/.test(sourceHash) ? sourceHash.slice(0, 12) : random.slice(24);
  return `${folder}/${random.slice(0, 24)}${tail}.${extension}`;
}

/** The photo's fingerprint (see above) or its URL when it is not one of
 * our uploads — two slides with the same value show the same picture. */
export function photoIdentity(url: string): string {
  const key = keyFromImageUrl(url);
  const match = key?.match(/([0-9a-f]{12})(?:\.sm)?\.(?:webp|jpg|png)$/);
  return match ? `fp:${match[1]}` : url;
}

export function thumbnailKey(key: string): string {
  return key.replace(/(\.sm)?\.(webp|jpg|png)$/, ".sm.$2");
}

/** The store logo's icons, or null when `logoUrl` is not a logo uploaded
 * with them. Photos are only ever WebP or JPEG (lib/client-upload.ts), so
 * a PNG in brand/ is how a logo from the logo upload is told apart. */
export function storeLogoIconUrls(
  logoUrl: string | null | undefined,
): { icon: string; favicon: string } | null {
  const key = logoUrl ? keyFromImageUrl(logoUrl) : null;
  if (!key || !STORE_LOGO_KEY.test(key)) return null;
  const base = key.slice(0, -".png".length);
  return {
    icon: imageUrlForKey(`${base}.icon.png`),
    favicon: imageUrlForKey(`${base}.favicon.png`),
  };
}

/** Every file stored for one upload — what deleting it has to remove. */
export function storedKeysFor(key: string): string[] {
  const keys = [key, thumbnailKey(key)];
  const icons = storeLogoIconUrls(imageUrlForKey(key));
  if (icons) keys.push(keyFromImageUrl(icons.icon)!, keyFromImageUrl(icons.favicon)!);
  return keys;
}

/** The upload a stored file belongs to — the key the database points at:
 * `products/<uuid>.sm.webp` → `products/<uuid>.webp`. */
export function uploadKeyFor(storedKey: string): string {
  return storedKey.replace(/\.(sm|icon|favicon)\.(webp|jpg|png)$/, ".$2");
}

const IMAGE_URL_IN_TEXT = /\/img\/([a-z]+\/[0-9a-f-]{36}(?:\.sm|\.icon|\.favicon)?\.(?:webp|jpg|png))/g;

/** Every upload a stored value points at — relative (`/img/…`), absolute
 * (`https://…/img/…`) or with a query string. Generous on purpose: what
 * this finds is never deleted. */
export function uploadKeysIn(value: string): string[] {
  return Array.from(value.matchAll(IMAGE_URL_IN_TEXT), (match) => match[1])
    .filter(isImageKey)
    .map(uploadKeyFor);
}
