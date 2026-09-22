"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";

const AUTOPLAY_MS = 5000;

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

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

export function ProductGallery({
  slides,
  productName,
  selectedColor,
  onSelectColor,
  autoplay = false,
  onInteract,
  discountPercent = 0,
}: {
  slides: GallerySlide[];
  productName: string;
  /** Drawn as a ribbon across the foot of the photo, the way a marked-down
   * item is flagged on a marketplace listing. 0 hides it. */
  discountPercent?: number;
  selectedColor: string;
  onSelectColor: (color: string) => void;
  /** Rotates the slides on its own while the shopper hasn't touched
   * anything — the parent turns it off for good at the first interaction. */
  autoplay?: boolean;
  onInteract?: () => void;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selected, setSelected] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // Mouse-driven zoom only where there is a real cursor: on a touch screen a
  // tap can fire a stray mousemove, which would leave the photo stuck at
  // 1.8x with no pointer left to move away.
  const canZoom = useMediaQuery("(hover: hover) and (pointer: fine)");

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const index = emblaApi.selectedScrollSnap();
    setSelected(index);
    const color = slides[index]?.color;
    if (color) onSelectColor(color);
  }, [emblaApi, slides, onSelectColor]);

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

  // Picking a color in the buy box moves the gallery to that color's photo.
  useEffect(() => {
    if (!emblaApi || !selectedColor) return;
    const index = slides.findIndex((slide) => slide.color === selectedColor);
    if (index >= 0) {
      emblaApi.scrollTo(index);
      return;
    }
    // This color has no photo of its own — fall back to the first general
    // shot so the big image at least stops showing another color's photo.
    const general = slides.findIndex((slide) => !slide.color);
    if (general >= 0) emblaApi.scrollTo(general);
  }, [selectedColor, slides, emblaApi]);

  useEffect(() => {
    if (!emblaApi || !autoplay || hovered || reducedMotion) return;
    if (slides.length < 2) return;
    const timer = setInterval(() => {
      if (emblaApi.canScrollNext()) emblaApi.scrollNext();
      else emblaApi.scrollTo(0);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [emblaApi, autoplay, hovered, reducedMotion, slides.length]);

  function goTo(index: number) {
    onInteract?.();
    emblaApi?.scrollTo(index);
  }

  if (slides.length === 0) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-lg bg-surface">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sem imagem
        </span>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex gap-4">
        <div className="hidden w-20 shrink-0 flex-col gap-3 md:flex">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => goTo(index)}
              title={slide.color ?? undefined}
              className={`relative aspect-[4/5] overflow-hidden rounded-md border transition-colors duration-200 ease-out ${
                selected === index ? "border-fg" : "border-line hover:border-ink-muted"
              }`}
              aria-label={
                slide.color
                  ? `Ver a cor ${slide.color}`
                  : `Ver imagem ${index + 1} de ${slides.length}`
              }
              aria-current={selected === index}
            >
              <Image
                src={slide.url}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {discountPercent > 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 rounded-b-lg bg-gold-soft py-1.5 text-center text-sm font-bold text-fg">
              -{discountPercent}% OFF
            </div>
          )}
          <div className="overflow-hidden" ref={emblaRef} onPointerDown={onInteract}>
          <div className="flex">
            {slides.map((slide, index) => (
              <div key={slide.id} className="min-w-0 flex-[0_0_100%]">
                <div
                  className={`relative aspect-[4/5] overflow-hidden rounded-lg bg-surface ${
                    canZoom ? "cursor-zoom-in" : ""
                  }`}
                  onMouseMove={
                    canZoom
                      ? (e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setZoom({
                            x: ((e.clientX - rect.left) / rect.width) * 100,
                            y: ((e.clientY - rect.top) / rect.height) * 100,
                          });
                        }
                      : undefined
                  }
                  onMouseLeave={canZoom ? () => setZoom(null) : undefined}
                >
                  {/* One photo per slide, not a desktop one plus a hidden
                      mobile one: a display:none image is downloaded all the
                      same, so that pair spent half of the page's image
                      budget on bytes nobody ever saw. The width asked for
                      below is deliberately wider than the box, because the
                      hover zoom blows the photo up to 1.8x and a file cut to
                      the box's own width goes soft the moment it does.
                      next/image never upscales past the uploaded file, so a
                      smaller original simply serves its own full size. */}
                  <Image
                    src={slide.url}
                    alt={slide.alt ?? productName}
                    fill
                    priority={index === 0}
                    quality={95}
                    sizes="(min-width: 1024px) 1200px, (min-width: 768px) 80vw, 100vw"
                    className="object-cover transition-transform duration-200 ease-out"
                    style={
                      zoom && selected === index
                        ? {
                            transform: "scale(1.8)",
                            transformOrigin: `${zoom.x}% ${zoom.y}%`,
                          }
                        : undefined
                    }
                  />
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-center gap-2 md:hidden">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => goTo(index)}
            aria-label={
              slide.color
                ? `Ver a cor ${slide.color}`
                : `Ver imagem ${index + 1} de ${slides.length}`
            }
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
