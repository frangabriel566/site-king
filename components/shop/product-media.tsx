"use client";

import { useCallback, useMemo, useState } from "react";
import { ProductGallery, type GallerySlide } from "@/components/shop/product-gallery";
import { ProductVideo } from "@/components/shop/product-video";
import { BuyBox, type ProductColor } from "@/components/shop/buy-box";
import { isColorlessVariant } from "@/lib/constants";
import type { ProductWithRelations, ProductImage } from "@/lib/data/products";

/** Shares the selected color between the gallery and the buy box — a
 * plain server-rendered layout can't do this since they're siblings, and
 * without it, picking a color never changes the displayed photo even when
 * the operator uploaded one for that color. */
export function ProductMedia({
  product,
  images,
  mainImage,
  whatsappEnabled,
}: {
  product: ProductWithRelations;
  images: ProductImage[];
  mainImage: string | null;
  whatsappEnabled: boolean;
}) {
  const variants = product.product_variants;

  // The product's distinct colors, in variant order. Built here rather than
  // inside the buy box so the gallery's thumbnail column and the swatches
  // are always the same list.
  const colors: ProductColor[] = useMemo(() => {
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
  }, [variants]);

  const [selectedColor, setSelectedColor] = useState(
    () => colors[0]?.color ?? variants[0]?.color ?? "",
  );
  const [autoplay, setAutoplay] = useState(true);
  const stopAutoplay = useCallback(() => setAutoplay(false), []);

  // One slide per color photo, and every slide stays on screen: the color
  // picker scrolls to its own photo instead of filtering the gallery down
  // to it, which is what used to leave a three-color product with a
  // one-thumbnail column.
  const slides: GallerySlide[] = useMemo(() => {
    const seen = new Set<string>();
    const list: GallerySlide[] = [];
    for (const { color, image_url } of colors) {
      if (!image_url || seen.has(image_url)) continue;
      seen.add(image_url);
      list.push({
        id: `color-${color}`,
        url: image_url,
        alt: `${product.name} — ${color}`,
        color,
      });
    }
    // The general gallery only joins in when the colors do not already
    // cover the product. Operators upload the same file twice — once as a
    // gallery image, once as that color photo — so appending it to a fully
    // photographed set of colors just shows every color twice, and the two
    // copies have different URLs, so no dedupe can catch them.
    const everyColorPhotographed = colors.length > 0 && list.length === colors.length;
    if (!everyColorPhotographed) {
      for (const image of images) {
        if (seen.has(image.url)) continue;
        seen.add(image.url);
        list.push({ id: image.id, url: image.url, alt: image.alt });
      }
    }
    // Product with no gallery at all, only a variant photo (simple products
    // are the usual case) — the page already resolved that fallback.
    if (list.length === 0 && mainImage) {
      list.push({ id: "main", url: mainImage, alt: null });
    }
    return list;
  }, [colors, images, mainImage, product.name]);

  return (
    <>
      <div className="order-1 lg:order-2">
        <ProductGallery
          slides={slides}
          productName={product.name}
          selectedColor={selectedColor}
          onSelectColor={setSelectedColor}
          autoplay={autoplay}
          onInteract={stopAutoplay}
          discountPercent={
            product.compare_at_price
              ? Math.round((1 - product.price / product.compare_at_price) * 100)
              : 0
          }
        />
        {product.video_url && <ProductVideo url={product.video_url} />}
      </div>
      {/* Touching the buy box — a swatch, a size, the keyboard — means the
          shopper is choosing for real, so the attract loop stops there and
          never swaps the color out from under them. */}
      <div
        className="order-2 lg:sticky lg:top-24 lg:order-3"
        onPointerDownCapture={stopAutoplay}
        onFocusCapture={stopAutoplay}
      >
        <BuyBox
          product={product}
          colors={colors}
          mainImage={mainImage}
          selectedColor={selectedColor}
          onColorChange={setSelectedColor}
          whatsappEnabled={whatsappEnabled}
        />
      </div>
    </>
  );
}
