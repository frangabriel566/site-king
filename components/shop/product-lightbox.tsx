"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SafeImage } from "@/components/shop/safe-image";
import type { GallerySlide } from "@/lib/product-gallery";

/** A tap zooms to this; a pinch can go up to MAX_SCALE. */
const TAP_SCALE = 2.5;
const MAX_SCALE = 4;
/** Movement under this is still a tap, not a drag. */
const TAP_SLOP = 8;
/** A pull down past this (px), released, closes the viewer. */
const DISMISS_DISTANCE = 110;

type View = { scale: number; x: number; y: number };
const RESET: View = { scale: 1, x: 0, y: 0 };

/**
 * Full-screen photos: swipe (or arrows/keys) between them, tap or click to
 * zoom into the spot touched, tap again to come back out, pinch to zoom
 * freely, drag to look around while zoomed.
 *
 * Built on the embla carousel the gallery already ships and plain pointer
 * events — no zoom library. Swiping is turned off while a photo is zoomed
 * (`watchDrag`), so a drag pans the photo instead of changing it.
 *
 * Mounted only while open (the gallery renders it conditionally), so it
 * costs nothing on the product page until someone opens it, and the
 * full-size files are only fetched for the photo on screen and its two
 * neighbours.
 */
export function ProductLightbox({
  slides,
  productName,
  title,
  startIndex,
  onClose,
}: {
  slides: Pick<GallerySlide, "id" | "url" | "alt">[];
  /** The alt text for slides without one. */
  productName: string;
  /** For screen readers; defaults to "Fotos de {productName}". */
  title?: string;
  startIndex: number;
  onClose: () => void;
}) {
  const zoomedRef = useRef(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    startIndex,
    loop: slides.length > 1,
    watchDrag: () => !zoomedRef.current,
  });
  const [index, setIndex] = useState(startIndex);
  const [hint, setHint] = useState(true);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  const near = (i: number) => {
    const distance = Math.abs(i - index);
    return distance <= 1 || distance === slides.length - 1;
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") emblaApi?.scrollPrev();
          if (event.key === "ArrowRight") emblaApi?.scrollNext();
        }}
        className="storefront-theme top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-black p-0 text-white ring-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{title ?? `Fotos de ${productName}`}</DialogTitle>
        <DialogDescription className="sr-only">
          Deslize ou use as setas para trocar de foto. Toque ou clique na foto para ampliar e
          arraste para mover. No celular, deslize para baixo para fechar.
        </DialogDescription>

        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-2 pt-[env(safe-area-inset-top)]">
          <p className="px-3 text-sm font-medium tabular-nums text-white/90" aria-live="polite">
            {index + 1} / {slides.length}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar fotos"
            className="flex size-12 touch-manipulation items-center justify-center rounded-full text-white hover:bg-white/10"
          >
            <X className="size-6" aria-hidden="true" />
          </button>
        </div>

        <div ref={emblaRef} className="h-full touch-none overflow-hidden">
          <div className="flex h-full">
            {slides.map((slide, i) => (
              <div
                key={slide.id}
                className="relative h-full min-w-0 flex-[0_0_100%]"
                role="group"
                aria-roledescription="foto"
                aria-label={`${i + 1} de ${slides.length}`}
              >
                <ZoomableSlide
                  slide={slide}
                  alt={slide.alt ?? productName}
                  active={i === index}
                  load={near(i)}
                  zoomedRef={zoomedRef}
                  onZoom={() => setHint(false)}
                  onDismiss={onClose}
                />
              </div>
            ))}
          </div>
        </div>

        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => emblaApi?.scrollPrev()}
              aria-label="Foto anterior"
              className="absolute top-1/2 left-3 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 md:flex"
            >
              <ChevronLeft className="size-6" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => emblaApi?.scrollNext()}
              aria-label="Próxima foto"
              className="absolute top-1/2 right-3 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 md:flex"
            >
              <ChevronRight className="size-6" aria-hidden="true" />
            </button>
          </>
        )}

        {hint && (
          <p className="pointer-events-none absolute inset-x-0 bottom-0 z-10 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] text-center text-xs font-medium text-white/80">
            Toque na foto para ampliar
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ZoomableSlide({
  slide,
  alt,
  active,
  load,
  zoomedRef,
  onZoom,
  onDismiss,
}: {
  slide: Pick<GallerySlide, "url">;
  alt: string;
  active: boolean;
  load: boolean;
  zoomedRef: RefObject<boolean>;
  onZoom: () => void;
  /** Swiped down far enough (touch, not zoomed): close the viewer. */
  onDismiss: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(RESET);
  // How far a finger has pulled the (unzoomed) photo down. Past
  // DISMISS_DISTANCE on release the viewer closes; short of it, it springs
  // back. The photo follows the finger and fades, so the gesture reads.
  const [pull, setPull] = useState(0);
  // Eased for a tap's zoom in/out; off while a finger drives it, or the
  // photo would trail behind the finger.
  const [eased, setEased] = useState(true);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    startX: number;
    startY: number;
    from: View;
    moved: boolean;
    pinch: { distance: number; midX: number; midY: number } | null;
    touch: boolean;
    pulling: boolean;
    /** The pull so far, read on release — state may not have re-rendered
     * yet when moves arrive faster than frames. */
    pulled: number;
  } | null>(null);

  // Leaving a photo zoomed in as it slides away would bring it back zoomed.
  useEffect(() => {
    if (!active) setView(RESET);
  }, [active]);

  useEffect(() => {
    if (active) zoomedRef.current = view.scale > 1;
  }, [active, view.scale, zoomedRef]);

  /** Keeps the photo covering the screen: never panned past its edges. */
  const clamp = useCallback((next: View): View => {
    const box = boxRef.current;
    if (!box || next.scale <= 1) return RESET;
    const maxX = ((next.scale - 1) * box.clientWidth) / 2;
    const maxY = ((next.scale - 1) * box.clientHeight) / 2;
    return {
      scale: next.scale,
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }, []);

  /** A point on screen, relative to the middle of the photo box. */
  function fromCenter(clientX: number, clientY: number) {
    const rect = boxRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      gesture.current = {
        startX: event.clientX,
        startY: event.clientY,
        from: view,
        moved: false,
        pinch: null,
        touch: event.pointerType !== "mouse",
        pulling: false,
        pulled: 0,
      };
    } else if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const mid = fromCenter((a.x + b.x) / 2, (a.y + b.y) / 2);
      setPull(0);
      gesture.current = {
        ...gesture.current,
        from: view,
        moved: true,
        pulling: false,
        pinch: { distance: Math.hypot(a.x - b.x, a.y - b.y), midX: mid.x, midY: mid.y },
      };
      zoomedRef.current = true;
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;

    if (g.pinch && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const scale = Math.min(
        MAX_SCALE,
        Math.max(1, g.from.scale * (Math.hypot(a.x - b.x, a.y - b.y) / g.pinch.distance)),
      );
      // The point between the fingers stays under the fingers.
      const ratio = scale / g.from.scale;
      setEased(false);
      setView(
        clamp({
          scale,
          x: g.pinch.midX - (g.pinch.midX - g.from.x) * ratio,
          y: g.pinch.midY - (g.pinch.midY - g.from.y) * ratio,
        }),
      );
      return;
    }

    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    if (Math.hypot(dx, dy) > TAP_SLOP) g.moved = true;
    if (g.from.scale > 1 && g.moved) {
      setEased(false);
      setView(clamp({ scale: g.from.scale, x: g.from.x + dx, y: g.from.y + dy }));
      return;
    }
    // Not zoomed, a finger going mostly down: pull to close. Sideways stays
    // the carousel's (embla only takes horizontal drags).
    if (g.touch && g.moved && (g.pulling || (dy > 0 && dy > Math.abs(dx) * 1.2))) {
      g.pulling = true;
      g.pulled = Math.max(0, dy);
      setEased(false);
      setPull(g.pulled);
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.delete(event.pointerId)) return;
    const g = gesture.current;
    if (pointers.current.size > 0 || !g) return;
    gesture.current = null;
    setEased(true);

    if (g.pinch) {
      if (view.scale < 1.1) setView(RESET);
      else onZoom();
      return;
    }
    if (g.pulling) {
      if (g.pulled > DISMISS_DISTANCE) onDismiss();
      else setPull(0);
      return;
    }
    if (g.moved) return;

    // A tap: in at the spot touched, or back out.
    if (view.scale > 1) {
      setView(RESET);
    } else {
      const point = fromCenter(event.clientX, event.clientY);
      setView(clamp({ scale: TAP_SCALE, x: point.x * (1 - TAP_SCALE), y: point.y * (1 - TAP_SCALE) }));
      onZoom();
    }
  }

  return (
    <div
      ref={boxRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`absolute inset-0 select-none ${view.scale > 1 ? "cursor-zoom-out" : "cursor-zoom-in"}`}
    >
      <div
        className={`absolute inset-0 ${eased ? "transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none" : ""}`}
        style={{
          transform: `translate3d(${view.x}px, ${view.y + pull}px, 0) scale(${view.scale})`,
          opacity: pull > 0 ? Math.max(0.4, 1 - pull / 400) : 1,
        }}
      >
        {load && (
          <SafeImage
            src={slide.url}
            alt={alt}
            fill
            reveal
            sizes="100vw"
            quality={90}
            draggable={false}
            className="object-contain"
          />
        )}
      </div>
    </div>
  );
}
