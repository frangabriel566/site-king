import type { Tables } from "@/lib/database.types";
import { isColorlessVariant } from "@/lib/constants";
import { photoIdentity } from "@/lib/image-url";

/**
 * How the product page's gallery is put together, kept out of the React
 * components so the listing can run the exact same rules on the server:
 * a card preloads the photo the product page is going to open on, and a
 * copy of these rules that drifted would preload the wrong one.
 */

/** A product's distinct color, as the buy box's swatches show it. */
export type ProductColor = {
  color: string;
  color_hex: string | null;
  image_url: string | null;
};

export type GallerySlide = {
  id: string;
  url: string;
  alt: string | null;
  /** Set when the slide is a color's own photo (product_variants.image_url).
   * Those slides double as the color picker: their thumbnail selects the
   * color, and landing on one — by click, swipe or autoplay — keeps the buy
   * box's selected color in sync with the photo on screen. */
  color?: string;
};

type ColorSource = Pick<Tables<"product_variants">, "color" | "color_hex" | "image_url">;
type ImageSource = Pick<Tables<"product_images">, "id" | "url" | "alt">;

/**
 * `sizes` and `quality` of the big gallery photo. The listing cards preload
 * that photo on hover/touch with these same values, and the preload only
 * pays off when both ask the optimizer for the byte-identical URL — a
 * different width or quality is a different file.
 *
 * Below `lg` the photo fills the column: the viewport minus the page's
 * gutters (`px-4`), and from `md` also minus the thumbnail column (`w-20`
 * plus `gap-4`). Asking for the whole viewport there fetched the next
 * srcset step up (1200px instead of 1080px on a typical phone) for pixels
 * that were never on screen. From `lg` on the width is deliberately wider
 * than the box, because the hover zoom blows the photo up to 1.8x and a
 * file cut to the box's own width goes soft the moment it does. 95 is for
 * the same zoom: at 1.8x every compression artifact shows.
 */
export const GALLERY_IMAGE_SIZES =
  "(min-width: 1024px) 1200px, (min-width: 768px) calc(100vw - 160px), calc(100vw - 32px)";
export const GALLERY_IMAGE_QUALITY = 95;

/** The product's distinct colors, in a stable order. The gallery's color
 * slides and the buy box's swatches are both built from this one list. */
export function getProductColors(variants: ColorSource[]): ProductColor[] {
  // Nothing to pick when every row carries the sentinel colour: either a
  // peça única, or a product sold in one colourway whose only real choice
  // is the size (the buy box still renders that picker from `variants`).
  if (variants.every((variant) => isColorlessVariant(variant.color))) return [];
  const map = new Map<string, ProductColor>();
  for (const variant of variants) {
    if (map.has(variant.color)) continue;
    map.set(variant.color, {
      color: variant.color,
      color_hex: variant.color_hex,
      image_url: variant.image_url,
    });
  }
  // product_variants has no position column and the query does not order
  // it, so Postgres can hand the rows back in a different order on every
  // request — which would reshuffle the gallery and the default color
  // between page loads. By name is arbitrary but at least stable.
  return Array.from(map.values()).sort((a, b) =>
    a.color.localeCompare(b.color, "pt-BR"),
  );
}

/**
 * The gallery's slides, in order. `images` must already be sorted by
 * position; `mainImage` is the page's own fallback photo.
 */
export function buildGallerySlides(
  productName: string,
  colors: ProductColor[],
  images: ImageSource[],
  mainImage: string | null,
): GallerySlide[] {
  // One slide per color photo, and every slide stays on screen: the color
  // picker scrolls to its own photo instead of filtering the gallery down
  // to it, which is what used to leave a three-color product with a
  // one-thumbnail column.
  // Deduped by picture, not URL: the same photo uploaded as the cover and
  // as a color's photo has two URLs but one fingerprint (lib/image-url.ts).
  const seen = new Set<string>();
  const list: GallerySlide[] = [];
  const colorByPhoto = new Map<string, string>();
  for (const { color, image_url } of colors) {
    if (image_url && !colorByPhoto.has(photoIdentity(image_url))) {
      colorByPhoto.set(photoIdentity(image_url), color);
    }
  }
  // The cover (first gallery photo, marked CAPA in the admin) always opens
  // the product page, ahead of the color photos — the store owner picks it
  // as the product's main shot (nov/2026). When it is also a color's
  // photo, it stands for that color and the color's copy is skipped.
  const cover = images[0];
  if (cover) {
    const identity = photoIdentity(cover.url);
    seen.add(identity);
    const color = colorByPhoto.get(identity);
    list.push({ id: cover.id, url: cover.url, alt: cover.alt, ...(color ? { color } : {}) });
  }
  for (const { color, image_url } of colors) {
    if (!image_url) continue;
    const identity = photoIdentity(image_url);
    if (seen.has(identity)) continue;
    seen.add(identity);
    list.push({
      id: `color-${color}`,
      url: image_url,
      alt: `${productName} — ${color}`,
      color,
    });
  }
  // The general gallery only joins in when the colors do not already
  // cover the product. Operators upload the same file twice — once as a
  // gallery image, once as that color photo — so appending it to a fully
  // photographed set of colors just shows every color twice, and the two
  // copies have different URLs, so no dedupe can catch them.
  const photographedColors = new Set(list.map((slide) => slide.color).filter(Boolean));
  const everyColorPhotographed =
    colors.length > 0 && colors.every(({ color }) => photographedColors.has(color));
  if (!everyColorPhotographed) {
    for (const image of images) {
      const identity = photoIdentity(image.url);
      if (seen.has(identity)) continue;
      seen.add(identity);
      list.push({ id: image.id, url: image.url, alt: image.alt });
    }
  }
  // Product with no gallery at all, only a variant photo (simple products
  // are the usual case) — the page already resolved that fallback.
  if (list.length === 0 && mainImage) {
    list.push({ id: "main", url: mainImage, alt: null });
  }
  return list;
}
