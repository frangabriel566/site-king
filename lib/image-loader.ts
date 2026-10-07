import type { ImageLoaderProps } from "next/image";
import { IMAGE_ROUTE_PREFIX } from "./image-url";

/** Up to this rendered width the thumbnail is enough (lib/client-upload.ts
 * makes it exactly this wide). */
const THUMBNAIL_MAX_WIDTH = 640;

/**
 * next/image loader for photos served by /img (Workers KV).
 *
 * There is no optimizer behind it — the browser already resized each photo
 * at upload, into a full-size file and a thumbnail. This only tells the
 * route which of the two a given srcset width wants: `v=sm` for cards and
 * lists, `v=lg` for the gallery and zoom.
 *
 * Anything else (seed photos on picsum.photos, files in /public) is passed
 * through untouched.
 */
export default function imageLoader({ src, width }: ImageLoaderProps): string {
  if (!src.startsWith(IMAGE_ROUTE_PREFIX)) return src;
  const variant = width <= THUMBNAIL_MAX_WIDTH ? "sm" : "lg";
  return `${src}${src.includes("?") ? "&" : "?"}v=${variant}`;
}
