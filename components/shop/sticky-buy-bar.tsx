"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";

// The bar only exists below the desktop layout, where the buy box sits in
// a sticky column and is always in reach anyway.
const MOBILE_QUERY = "(max-width: 1023.98px)";
// Scrolled this far before the bar may appear — on arrival the shopper is
// looking at the photos, and a bar popping up at once reads as an ad.
const SCROLL_START_PX = 80;

/**
 * Mobile buy bar for the product page: price and "Comprar", pinned to the
 * bottom of the screen while the real buy button is out of view, gone the
 * moment that button is back on screen.
 *
 * "Comprar" runs the same handler as the main button, so with no size
 * picked it scrolls up to the size selector and says so, instead of
 * guessing a size.
 *
 * While it is up it publishes its height as --sticky-buy-h on <html>: the
 * storefront pads its bottom by that much (globals.css) so the end of the
 * page is never hidden, and the WhatsApp button lifts above it.
 */
export function StickyBuyBar({
  watchRef,
  price,
  compareAtPrice,
  installments,
  pending,
  onBuy,
}: {
  watchRef: RefObject<HTMLElement | null>;
  price: number;
  compareAtPrice: number | null;
  installments: string | null;
  pending: boolean;
  onBuy: () => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  // Initial values match the server render (bar hidden), so hydration
  // never sees a difference; the effects below decide on the client.
  const [buttonOnScreen, setButtonOnScreen] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const target = watchRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) =>
      setButtonOnScreen(entry.isIntersecting),
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [watchRef]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_START_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const visible = isMobile && scrolled && !buttonOnScreen;

  useEffect(() => {
    const root = document.documentElement;
    if (visible && barRef.current) {
      root.style.setProperty("--sticky-buy-h", `${barRef.current.offsetHeight}px`);
    } else {
      root.style.removeProperty("--sticky-buy-h");
    }
    return () => {
      root.style.removeProperty("--sticky-buy-h");
    };
  }, [visible]);

  return (
    <div
      ref={barRef}
      inert={!visible}
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pt-3 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] backdrop-blur-sm transition-transform duration-200 ease-out motion-reduce:transition-none lg:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <div className="min-w-0 flex-1">
          {compareAtPrice && (
            <p className="text-[11px] leading-none text-muted-foreground line-through">
              {formatCurrency(compareAtPrice)}
            </p>
          )}
          <p className="text-lg font-extrabold leading-tight text-buy">{formatCurrency(price)}</p>
          {installments && (
            <p className="truncate text-[11px] leading-tight text-muted-foreground">{installments}</p>
          )}
        </div>
        <Button
          size="lg"
          className="h-12 shrink-0 bg-buy px-8 text-base text-white hover:bg-buy-hover"
          onClick={onBuy}
          disabled={pending}
        >
          {pending ? "Comprando…" : "Comprar"}
        </Button>
      </div>
    </div>
  );
}
