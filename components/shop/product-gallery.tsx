"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import type { ProductImage } from "@/lib/data/products";

type GalleryImage = Pick<ProductImage, "id" | "url" | "alt">;

export function ProductGallery({
  images,
  productName,
  activeColorImage,
}: {
  images: ProductImage[];
  productName: string;
  /** The selected color's own photo (product_variants.image_url), if the
   * operator uploaded one — shown as the active slide so picking a color
   * actually changes the photo instead of leaving the gallery untouched. */
  activeColorImage?: string | null;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [selected, setSelected] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);

  // A color with its own dedicated photo shows THAT and only that — not
  // merged with the general gallery. The general gallery isn't filtered
  // by color at all, so mixing it in meant every color selection also
  // pulled in every OTHER color's general photo (plus its own, often
  // duplicating what the color photo already showed): picking "Preto"
  // could show two black photos, a beige one and a green one all at
  // once. Falls back to the general gallery only when this particular
  // color has no dedicated photo of its own.
  const displayImages: GalleryImage[] = useMemo(() => {
    if (activeColorImage) {
      return [{ id: `color-photo-${activeColorImage}`, url: activeColorImage, alt: null }];
    }
    return images;
  }, [images, activeColorImage]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (!activeColorImage || !emblaApi) return;
    const index = displayImages.findIndex((img) => img.url === activeColorImage);
    if (index >= 0) emblaApi.scrollTo(index);
  }, [activeColorImage, displayImages, emblaApi]);

  if (displayImages.length === 0) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-lg bg-surface">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sem imagem
        </span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-4">
        <div className="hidden w-20 shrink-0 flex-col gap-3 md:flex">
          {displayImages.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => emblaApi?.scrollTo(index)}
              className={`relative aspect-[4/5] overflow-hidden rounded-md border transition-colors duration-200 ease-out ${
                selected === index ? "border-fg" : "border-line hover:border-ink-muted"
              }`}
              aria-label={`Ver imagem ${index + 1} de ${displayImages.length}`}
              aria-current={selected === index}
            >
              <Image
                src={image.url}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {displayImages.map((image, index) => (
              <div key={image.id} className="min-w-0 flex-[0_0_100%]">
                <div
                  className="relative aspect-[4/5] cursor-zoom-in overflow-hidden rounded-lg bg-surface"
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setZoom({
                      x: ((e.clientX - rect.left) / rect.width) * 100,
                      y: ((e.clientY - rect.top) / rect.height) * 100,
                    });
                  }}
                  onMouseLeave={() => setZoom(null)}
                >
                  <Image
                    src={image.url}
                    alt={image.alt ?? productName}
                    fill
                    priority={index === 0}
                    sizes="(min-width: 768px) 45vw, 100vw"
                    className="hidden object-cover transition-transform duration-200 ease-out md:block"
                    style={
                      zoom && selected === index
                        ? {
                            transform: "scale(1.8)",
                            transformOrigin: `${zoom.x}% ${zoom.y}%`,
                          }
                        : undefined
                    }
                  />
                  <Image
                    src={image.url}
                    alt={image.alt ?? productName}
                    fill
                    priority={index === 0}
                    sizes="100vw"
                    className="object-cover md:hidden"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-center gap-2 md:hidden">
        {displayImages.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => emblaApi?.scrollTo(index)}
            aria-label={`Ver imagem ${index + 1} de ${displayImages.length}`}
            aria-current={selected === index}
            className={`size-1.5 rounded-full transition-colors duration-200 ease-out ${
              selected === index ? "bg-fg" : "bg-line"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
