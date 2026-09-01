"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import type { ProductImage } from "@/lib/data/products";

export function ProductGallery({
  images,
  productName,
}: {
  images: ProductImage[];
  productName: string;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [selected, setSelected] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center bg-[#111111]">
        <span className="text-label">Sem imagem</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-4">
        <div className="hidden w-20 shrink-0 flex-col gap-3 md:flex">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => emblaApi?.scrollTo(index)}
              className={`relative aspect-[4/5] overflow-hidden border transition-colors duration-200 ease-out ${
                selected === index ? "border-fg" : "border-line hover:border-ink-muted"
              }`}
              aria-label={`Ver imagem ${index + 1} de ${images.length}`}
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
            {images.map((image, index) => (
              <div key={image.id} className="min-w-0 flex-[0_0_100%]">
                <div
                  className="relative aspect-[4/5] cursor-zoom-in overflow-hidden bg-[#111111]"
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
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => emblaApi?.scrollTo(index)}
            aria-label={`Ver imagem ${index + 1} de ${images.length}`}
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
