"use client";

import { useCallback, useMemo, useState } from "react";
import { ProductGallery } from "@/components/shop/product-gallery";
import { ProductVideo } from "@/components/shop/product-video";
import { BuyBox } from "@/components/shop/buy-box";
import { readCardImage } from "@/lib/image-handoff";
import { buildGallerySlides, getProductColors } from "@/lib/product-gallery";
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
  const colors = useMemo(() => getProductColors(variants), [variants]);

  const [selectedColor, setSelectedColor] = useState(
    () => colors[0]?.color ?? variants[0]?.color ?? "",
  );
  const [autoplay, setAutoplay] = useState(true);
  const stopAutoplay = useCallback(() => setAutoplay(false), []);

  const slides = useMemo(
    () => buildGallerySlides(product.name, colors, images, mainImage),
    [colors, images, mainImage, product.name],
  );

  // The photo the shopper just tapped in the listing, already decoded in
  // the browser. Read once, at mount: it only has to cover the first paint.
  const [cardImage] = useState(() => readCardImage(product.slug));
  // Only when it is the same file the gallery opens on. For a product with
  // color photos the card shows the first gallery photo while the gallery
  // opens on the first color, and standing one in for the other would
  // flash a different photo before the right one lands.
  const heroPlaceholder =
    cardImage && cardImage.src === slides[0]?.url ? cardImage.shownSrc : undefined;

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
          heroPlaceholder={heroPlaceholder}
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
