"use client";

import { useEffect, useState } from "react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { HeroBanner } from "@/components/shop/hero-banner";
import { googleFontsHref, type HeroBannerData } from "@/lib/banner-style";
import { cn } from "@/lib/utils";

const AUTOPLAY_MS = 7000;

/** The screen below the sticky header, never too short for the texts. */
export const SITE_BANNER_FRAME =
  "h-[max(740px,calc(100svh-150px))] md:h-[clamp(560px,calc(100svh-150px),880px)]";

/**
 * The home's top: the active banners from Painel → Banners. One banner is
 * shown on its own; two or more pass by themselves (and by swiping), with
 * dots to pick one.
 */
export function HeroBanners({
  banners,
  whatsappHref,
}: {
  banners: HeroBannerData[];
  whatsappHref: string | null;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);
  const fontsHref = googleFontsHref(
    banners.filter((banner) => banner.kind === "editavel").map((banner) => banner.style),
  );

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
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const timer = setInterval(() => api.scrollNext(), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [api, banners.length]);

  if (banners.length === 0) return null;

  const fonts = fontsHref ? <link rel="stylesheet" href={fontsHref} precedence="default" /> : null;

  if (banners.length === 1) {
    return (
      <>
        {fonts}
        <HeroBanner
          banner={banners[0]}
          whatsappHref={whatsappHref}
          frameClass={SITE_BANNER_FRAME}
          priority
          asHeading
        />
      </>
    );
  }

  return (
    <div className="relative">
      {fonts}
      <Carousel setApi={setApi} opts={{ loop: true }} aria-label="Banners">
        <CarouselContent className="-ml-0 items-center">
          {banners.map((banner, index) => (
            <CarouselItem
              key={banner.id}
              className="pl-0"
              aria-label={`${index + 1} de ${banners.length}`}
            >
              <HeroBanner
                banner={banner}
                whatsappHref={whatsappHref}
                frameClass={SITE_BANNER_FRAME}
                priority={index === 0}
                asHeading={index === 0}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1">
        {banners.map((banner, index) => (
          <button
            key={banner.id}
            type="button"
            aria-label={`Ver banner ${index + 1}`}
            aria-current={index === selected}
            onClick={() => api?.scrollTo(index)}
            className="flex size-6 items-center justify-center"
          >
            <span
              className={cn(
                "block h-1.5 rounded-full transition-all duration-200",
                index === selected ? "w-5 bg-gold" : "w-1.5 bg-white/40",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
