"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Expand, Quote, Star } from "lucide-react";
import { SafeImage } from "@/components/shop/safe-image";
import { ProductLightbox } from "@/components/shop/product-lightbox";
import type { FeedbackCardData, FeedbackImage } from "@/lib/data/feedbacks";

const AUTOPLAY_MS = 5000;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * "O que nossos clientes dizem": the feedbacks published in the panel, as
 * a carousel — one card at a time on a phone, two on a tablet, three on a
 * desktop — with arrows, dots and swipe.
 *
 * It moves on its own every ~5 s, slowly, and only while nobody is
 * looking at it closely: a mouse over it pauses it, and the first touch,
 * click or keyboard focus stops it for good. With "reduce motion" on in
 * the system it never moves by itself. A drag that starts inside a card's
 * photo strip is that strip's, not the carousel's.
 *
 * Built on embla, which the banner and the product gallery already ship.
 */
export function FeedbackCarousel({
  title,
  feedbacks,
  contained = true,
}: {
  title: string;
  feedbacks: FeedbackCardData[];
  /** Its own page-width container and spacing (the home); off inside a page
   * that already has them (the product page). */
  contained?: boolean;
}) {
  const [emblaRef, api] = useEmblaCarousel({
    align: "start",
    loop: feedbacks.length > 1,
    watchDrag: (_api, event) => !(event.target as Element | null)?.closest?.("[data-inner-carousel]"),
  });
  const [selected, setSelected] = useState(0);
  const [snaps, setSnaps] = useState<number[]>([]);
  const [hovered, setHovered] = useState(false);
  const [stopped, setStopped] = useState(false);
  const reducedMotion = useReducedMotion();
  const [lightbox, setLightbox] = useState<{ feedback: FeedbackCardData; index: number } | null>(null);

  useEffect(() => {
    if (!api) return;
    const sync = () => {
      setSnaps(api.scrollSnapList());
      setSelected(api.selectedScrollSnap());
    };
    sync();
    api.on("select", sync);
    api.on("reInit", sync);
    return () => {
      api.off("select", sync);
      api.off("reInit", sync);
    };
  }, [api]);

  useEffect(() => {
    if (!api || stopped || hovered || reducedMotion || lightbox || snaps.length < 2) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") api.scrollNext();
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [api, stopped, hovered, reducedMotion, lightbox, snaps.length]);

  const stop = useCallback(() => setStopped(true), []);

  return (
    <section
      aria-roledescription="carrossel"
      aria-label={title}
      className={contained ? "mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8" : undefined}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onPointerDownCapture={stop}
      onFocusCapture={stop}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-fg md:text-2xl">{title}</h2>
        {snaps.length > 1 && (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => api?.scrollPrev()}
              aria-label="Feedback anterior"
              className="flex size-10 items-center justify-center rounded-full border border-line bg-bg text-fg transition-colors hover:bg-surface-2"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => api?.scrollNext()}
              aria-label="Próximo feedback"
              className="flex size-10 items-center justify-center rounded-full border border-line bg-bg text-fg transition-colors hover:bg-surface-2"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div ref={emblaRef} className="overflow-hidden">
        <ul className="-ml-4 flex touch-pan-y">
          {feedbacks.map((feedback, i) => (
            <li
              key={feedback.id}
              className="min-w-0 flex-[0_0_100%] pl-4 sm:flex-[0_0_50%] lg:flex-[0_0_33.3333%]"
              aria-roledescription="slide"
              aria-label={`${i + 1} de ${feedbacks.length}`}
            >
              <FeedbackCard
                feedback={feedback}
                onOpen={(index) => {
                  stop();
                  setLightbox({ feedback, index });
                }}
              />
            </li>
          ))}
        </ul>
      </div>

      {snaps.length > 1 && (
        <div className="mt-3 flex justify-center">
          {snaps.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => api?.scrollTo(index)}
              aria-label={`Ir para o feedback ${index + 1}`}
              aria-current={index === selected}
              className="flex size-6 items-center justify-center"
            >
              <span
                className={`size-2 rounded-full transition-colors duration-200 ${
                  index === selected ? "bg-fg" : "bg-ink-muted/35"
                }`}
              />
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <ProductLightbox
          slides={lightbox.feedback.images.map((image, index) => ({
            id: `${lightbox.feedback.id}-${index}`,
            url: image.url,
            alt: null,
          }))}
          productName={`Imagem enviada por ${lightbox.feedback.name}`}
          title={`Imagens do feedback de ${lightbox.feedback.name}`}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </section>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <p role="img" className="flex items-center gap-0.5 text-[#E8A317]" aria-label={`Nota ${rating} de 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className="size-4"
          fill={value <= rating ? "currentColor" : "none"}
          strokeWidth={value <= rating ? 0 : 1.5}
          aria-hidden="true"
        />
      ))}
    </p>
  );
}

function FeedbackCard({
  feedback,
  onOpen,
}: {
  feedback: FeedbackCardData;
  onOpen: (index: number) => void;
}) {
  const hasImages = feedback.images.length > 0;
  return (
    // A text-only feedback is a quote card: bigger words on a tinted ground,
    // so next to the photo cards it reads as intended, not as a card that
    // lost its picture.
    <article
      className={`flex h-full flex-col overflow-hidden rounded-lg border border-line ${
        hasImages ? "bg-white" : "bg-surface"
      }`}
    >
      {hasImages ? (
        <FeedbackImages images={feedback.images} name={feedback.name} onOpen={onOpen} />
      ) : (
        <Quote className="mx-5 mt-6 size-10 text-gold-text/50" aria-hidden="true" />
      )}
      <div className={`flex flex-1 flex-col gap-2 ${hasImages ? "p-4" : "px-5 pt-3 pb-5"}`}>
        {feedback.rating !== null && <Stars rating={feedback.rating} />}
        {feedback.text && (
          <p
            className={
              hasImages
                ? "line-clamp-4 text-sm leading-relaxed text-fg"
                : "line-clamp-10 text-lg leading-relaxed font-medium text-fg md:text-xl"
            }
          >
            {feedback.text}
          </p>
        )}
        <p className="mt-auto pt-1 text-sm">
          <span className="font-semibold text-fg">{feedback.name}</span>
          {feedback.location && <span className="text-muted-foreground"> · {feedback.location}</span>}
        </p>
      </div>
    </article>
  );
}

/**
 * The card's photos/prints: the first one, and — when there are more — a
 * swipeable strip with "1/3". Only the first image loads with the page;
 * the rest wait until the shopper reaches for the strip, so a home full
 * of feedbacks doesn't download every photo of every card.
 *
 * A print shows the top of the conversation; tapping opens all of the
 * feedback's images full screen, where a print reads at full size.
 */
function FeedbackImages({
  images,
  name,
  onOpen,
}: {
  images: FeedbackImage[];
  name: string;
  onOpen: (index: number) => void;
}) {
  const [emblaRef, api] = useEmblaCarousel({ loop: false });
  const [index, setIndex] = useState(0);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => {
      setIndex(api.selectedScrollSnap());
      setArmed(true);
    };
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  const many = images.length > 1;

  return (
    <div
      className="relative aspect-[4/5] bg-surface"
      data-inner-carousel={many ? "" : undefined}
      onPointerDown={() => setArmed(true)}
      onFocus={() => setArmed(true)}
    >
      <div ref={many ? emblaRef : undefined} className="h-full overflow-hidden">
        <div className="flex h-full">
          {images.map((image, i) => (
            <div key={image.url} className="relative h-full min-w-0 flex-[0_0_100%]">
              {(i === 0 || armed) && (
                <button
                  type="button"
                  onClick={() => onOpen(i)}
                  aria-label={`Ver imagem ${i + 1}${many ? ` de ${images.length}` : ""} em tela cheia`}
                  className="absolute inset-0 cursor-zoom-in"
                >
                  <SafeImage
                    src={image.url}
                    alt={image.kind === "chat" ? `Conversa com ${name}` : `Foto enviada por ${name}`}
                    fill
                    skeleton
                    sizes="(min-width: 1024px) 420px, (min-width: 640px) 45vw, 90vw"
                    className={`object-cover ${image.kind === "chat" ? "object-top" : ""}`}
                  />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      {many && (
        <span className="pointer-events-none absolute top-2 left-2 rounded-full bg-black/65 px-2 py-0.5 text-xs font-semibold text-white tabular-nums">
          {index + 1}/{images.length}
        </span>
      )}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-2 bottom-2 flex size-8 items-center justify-center rounded-full bg-white/90 text-fg shadow-sm"
      >
        <Expand className="size-4" />
      </span>
    </div>
  );
}
