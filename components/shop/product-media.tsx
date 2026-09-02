"use client";

import { useState } from "react";
import { ProductGallery } from "@/components/shop/product-gallery";
import { ProductVideo } from "@/components/shop/product-video";
import { BuyBox } from "@/components/shop/buy-box";
import type { ProductWithRelations, ProductImage } from "@/lib/data/products";

/** Shares the selected color between the gallery and the buy box — a
 * plain server-rendered layout can't do this since they're siblings, and
 * without it, picking a color never changes the displayed photo even when
 * the operator uploaded one for that color. */
export function ProductMedia({
  product,
  images,
  mainImage,
}: {
  product: ProductWithRelations;
  images: ProductImage[];
  mainImage: string | null;
}) {
  const [selectedColor, setSelectedColor] = useState(
    () => product.product_variants[0]?.color ?? "",
  );

  const activeColorImage =
    product.product_variants.find((v) => v.color === selectedColor)?.image_url ?? null;

  return (
    <>
      <div className="order-1 lg:order-2">
        <ProductGallery
          images={images}
          productName={product.name}
          activeColorImage={activeColorImage}
        />
        {product.video_url && <ProductVideo url={product.video_url} />}
      </div>
      <div className="order-2 lg:sticky lg:top-24 lg:order-3">
        <BuyBox
          product={product}
          mainImage={mainImage}
          selectedColor={selectedColor}
          onColorChange={setSelectedColor}
        />
      </div>
    </>
  );
}
