import { getImageProps } from "next/image";
import { GALLERY_IMAGE_QUALITY, GALLERY_IMAGE_SIZES } from "@/lib/product-gallery";

/**
 * Hands the product page a head start from the listing card the shopper is
 * about to tap. Browser-only: both functions are called from event
 * handlers, and the product page reads the map after a client-side
 * navigation — a fresh page load starts with it empty, which is also what
 * the server rendered, so hydration never sees a difference.
 *
 * <Link> already prefetches the route itself (in the viewport, and again on
 * hover/touch); what it cannot fetch ahead is the photo, because that URL
 * only exists once the product page renders its gallery.
 */

type CardImage = {
  /** The photo's source URL (Supabase Storage), as the gallery knows it. */
  src: string;
  /** The exact file the card displayed (the optimizer URL it picked from its
   * srcset), which is what sits in the browser cache. */
  shownSrc: string;
};

const cardImages = new Map<string, CardImage>();
const preloaded = new Set<string>();
// Holds each preload until it settles: a detached `new Image()` with nothing
// referencing it is fair game for the garbage collector mid-download.
const inFlight = new Set<HTMLImageElement>();

/** Remembers what the card for `slug` is showing, so the product page can
 * paint that same (already cached) file while its own photo loads. */
export function rememberCardImage(slug: string, src: string, img: HTMLImageElement | null) {
  // A photo still loading is not in the cache yet — standing it in would
  // just be another blank box.
  if (!img || !img.complete || img.naturalWidth === 0 || !img.currentSrc) return;
  cardImages.set(slug, { src, shownSrc: img.currentSrc });
}

export function readCardImage(slug: string): CardImage | null {
  return cardImages.get(slug) ?? null;
}

/**
 * Starts downloading the gallery's big photo before the product page asks
 * for it. It goes through `getImageProps` with the gallery's own `sizes` and
 * `quality`, so the srcset is the same string the page renders and the
 * browser picks the same candidate out of it — one download, reused.
 */
export function preloadGalleryImage(src: string, fetchPriority: "high" | "auto") {
  if (preloaded.has(src)) return;
  preloaded.add(src);
  const { props } = getImageProps({
    src,
    alt: "",
    fill: true,
    sizes: GALLERY_IMAGE_SIZES,
    quality: GALLERY_IMAGE_QUALITY,
  });
  const img = new Image();
  img.fetchPriority = fetchPriority;
  img.decoding = "async";
  // `sizes` before `srcset`: the candidate is chosen from whatever is set
  // when the browser gets to it, and without `sizes` that means 100vw.
  if (props.sizes) img.sizes = props.sizes;
  if (props.srcSet) img.srcset = props.srcSet;
  img.src = props.src;
  inFlight.add(img);
  img.addEventListener("load", () => inFlight.delete(img), { once: true });
  img.addEventListener(
    "error",
    () => {
      inFlight.delete(img);
      // A failed preload is not a reason to never try again: the next
      // hover gets another go, and the page has its own retries anyway.
      preloaded.delete(src);
    },
    { once: true },
  );
}
