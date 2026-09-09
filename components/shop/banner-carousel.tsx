"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import type { Banner } from "@/lib/data/banners";

const AUTOPLAY_MS = 6000;

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSelected(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  useEffect(() => {
    if (!api || banners.length < 2) return;
    const timer = setInterval(() => {
      if (api.canScrollNext()) api.scrollNext();
      else api.scrollTo(0);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [api, banners.length]);

  if (banners.length === 0) return null;

  return (
    <div className="relative mx-auto max-w-[3840px]">
      <Carousel setApi={setApi} opts={{ loop: true }}>
        <CarouselContent className="-ml-0">
          {banners.map((banner) => (
            <CarouselItem key={banner.id} className="pl-0">
              <Link
                href={banner.cta_href || "/colecao"}
                className="relative block aspect-[12/5] w-full overflow-hidden bg-surface"
              >
                {banner.image_url && (
                  <Image
                    src={banner.image_url}
                    alt={banner.headline_line1 ?? banner.wordmark ?? ""}
                    fill
                    priority
                    quality={90}
                    sizes="100vw"
                    className="object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-12">
                  {banner.eyebrow && (
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold">
                      {banner.eyebrow}
                    </p>
                  )}
                  {(banner.headline_line1 || banner.headline_line2) && (
                    <p className="max-w-lg text-2xl font-bold leading-tight md:text-4xl">
                      {banner.headline_line1}
                      {banner.headline_line2 && (
                        <>
                          <br />
                          {banner.headline_line2}
                        </>
                      )}
                    </p>
                  )}
                  {banner.cta_label && (
                    <span className="mt-3 inline-block rounded-md bg-white px-3 py-1 text-xs font-semibold text-fg md:mt-4 md:px-5 md:py-2 md:text-sm">
                      {banner.cta_label}
                    </span>
                  )}
                </div>
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          {banners.map((banner, index) => (
            <button
              key={banner.id}
              type="button"
              aria-label={`Ir para o slide ${index + 1}`}
              onClick={() => api?.scrollTo(index)}
              className={`h-1.5 rounded-full transition-all duration-200 ease-out ${
                index === selected ? "w-6 bg-white" : "w-1.5 bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
