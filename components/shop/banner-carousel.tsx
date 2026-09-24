"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SafeImage } from "@/components/shop/safe-image";
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
          {banners.map((banner, index) => (
            <CarouselItem key={banner.id} className="pl-0">
              <Link
                href={banner.cta_href || "/colecao"}
                className="relative block aspect-[12/5] w-full overflow-hidden bg-surface"
              >
                {banner.image_url && (
                  <SafeImage
                    src={banner.image_url}
                    alt={banner.headline_line1 ?? banner.wordmark ?? ""}
                    fill
                    priority={index === 0}
                    quality={90}
                    sizes="100vw"
                    className="object-cover"
                    fallbackLabel=""
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                {(banner.eyebrow || banner.headline_line1 || banner.headline_line2) && (
                  <div className="absolute inset-x-0 bottom-16 p-6 text-white md:bottom-24 md:p-12">
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
                  </div>
                )}
                {banner.cta_label && (
                  // Positioned on its own, independent of the headline block
                  // above — the CTA needs to clear whatever artwork (e.g. a
                  // wordmark) sits lower in the banner image, regardless of
                  // whether this banner has headline text at all.
                  <span className="absolute bottom-4 left-6 inline-block rounded-md bg-white px-3 py-1 text-xs font-semibold text-fg md:bottom-8 md:left-12 md:px-5 md:py-2 md:text-sm">
                    {banner.cta_label}
                  </span>
                )}
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
              // A 6px-tall dash is a marker, not a button — the pseudo
              // gives each one a ~44px-tall strip to be tapped in without
              // fattening the dashes themselves. The horizontal spread
              // stops at 4px a side so neighbouring strips meet rather
              // than overlap across the `gap-2`, which would hand a tap
              // near the boundary to the wrong slide.
              className={`relative touch-manipulation before:absolute before:-inset-x-1 before:-inset-y-5 before:content-[''] h-1.5 rounded-full transition-all duration-200 ease-out ${
                index === selected ? "w-6 bg-white" : "w-1.5 bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
