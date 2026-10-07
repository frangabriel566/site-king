"use client";

import { useCallback, useEffect, useState } from "react";
import { SafeImage } from "@/components/shop/safe-image";
import useEmblaCarousel from "embla-carousel-react";
import { Expand } from "lucide-react";
import { ProductLightbox } from "@/components/shop/product-lightbox";
import {
  GALLERY_IMAGE_QUALITY,
  GALLERY_IMAGE_SIZES,
  type GallerySlide,
} from "@/lib/product-gallery";

export type { GallerySlide };

const AUTOPLAY_MS = 5000;

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
  heroPlaceholder,
}: {
  slides: GallerySlide[];
  productName: string;
  /** The listing card's already-downloaded copy of the first slide's photo,
   * painted under it until the full-size file arrives. */
  heroPlaceholder?: string;
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
  // The full-screen viewer, open on this slide; null while closed.
  const [lightbox, setLightbox] = useState<number | null>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // Mouse-driven zoom only where there is a real cursor: on a touch screen a
  // tap can fire a stray mousemove, which would leave the photo stuck at
  // 1.8x with no pointer left to move away.
  const canZoom = useMediaQuery("(hover: hover) and (pointer: fine)");
  // The other slides hold their download until the first photo is in. They
  // are `lazy`, but the looping carousel keeps its neighbours right next to
  // the viewport, so the browser fetched them all at once and the photo on
  // screen shared a phone's bandwidth with two or three it wasn't showing.
  // Any touch on the gallery lets them go immediately, and the slide being
  // shown always loads.
  const [restReleased, setRestReleased] = useState(false);
  const releaseRest = useCallback(() => setRestReleased(true), []);

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

  function openLightbox(index: number) {
    onInteract?.();
    setZoom(null);
    setLightbox(index);
  }

  function goTo(index: number) {
    onInteract?.();
    releaseRest();
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
              <SafeImage
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
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 rounded-b-lg bg-buy py-1.5 text-center text-sm font-bold text-white">
              -{discountPercent}% OFF
            </div>
          )}
          {/* Says the photo opens bigger; the tap itself lands on the
              photo's own button underneath. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full bg-white/90 text-fg shadow-sm"
          >
            <Expand className="size-4" />
          </span>
          <div
            className="overflow-hidden"
            ref={emblaRef}
            onPointerDown={() => {
              onInteract?.();
              releaseRest();
            }}
          >
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
                  {/* The whole photo opens the full-screen viewer. A button,
                      so it is reachable by keyboard too; a swipe does not
                      click it (embla swallows the click after a drag). */}
                  <button
                    type="button"
                    onClick={() => openLightbox(index)}
                    aria-label={`Ampliar foto ${index + 1} de ${slides.length}`}
                    className="absolute inset-0 z-[1] cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-fg"
                    tabIndex={index === selected ? 0 : -1}
                  />
                  {/* One photo per slide, not a desktop one plus a hidden
                      mobile one: a display:none image is downloaded all the
                      same, so that pair spent half of the page's image
                      budget on bytes nobody ever saw. Why the width asked
                      for is wider than the box on desktop is next to
                      GALLERY_IMAGE_SIZES. next/image never upscales past the
                      uploaded file, so a smaller original simply serves its
                      own full size. */}
                  {(index === 0 || restReleased || index === selected) && (
                    <SafeImage
                      src={slide.url}
                      alt={slide.alt ?? productName}
                      fill
                      reveal
                      placeholderSrc={index === 0 ? heroPlaceholder : undefined}
                      priority={index === 0}
                      // `priority` only makes it eager and preloads it; the
                      // request itself still starts at the low priority every
                      // image gets until layout proves it is on screen.
                      fetchPriority={index === 0 ? "high" : "low"}
                      onLoad={index === 0 ? releaseRest : undefined}
                      quality={GALLERY_IMAGE_QUALITY}
                      sizes={GALLERY_IMAGE_SIZES}
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
                  )}
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>
      </div>

      {/* The dots stay 6px, but each sits in a 24px button: a dot-sized
          target can't be hit with a thumb. */}
      <div className="mt-2 flex justify-center md:hidden">
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
            className="flex size-6 touch-manipulation items-center justify-center"
          >
            <span
              className={`size-1.5 rounded-full transition-colors duration-200 ease-out ${
                selected === index ? "bg-fg" : "bg-ink-muted/40"
              }`}
            />
          </button>
        ))}
      </div>

      {lightbox !== null && (
        <ProductLightbox
          slides={slides}
          productName={productName}
          startIndex={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
