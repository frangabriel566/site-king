"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Closes an overlay on every navigation.
 *
 * A drawer that survives a route change is not a cosmetic problem. While
 * one is open Radix holds `pointer-events: none` on the body and
 * react-remove-scroll holds `body[data-scroll-locked]`, so a drawer left
 * open on a page the shopper has already moved on from takes the whole
 * document with it: nothing scrolls, nothing is tappable, and the only
 * way out is a reload. The bag used to do exactly this — its open state
 * lives in CartProvider up in the shop layout, which outlives every page
 * under it, so pressing Back with the bag open carried it to the next
 * route still open and still holding both locks.
 *
 * `usePathname` alone is not enough. It never fires for a back or
 * forward that only rewrites the query string (`/colecao?categoria=…`,
 * which is every filter on the collection page), and it does not fire at
 * all when iOS restores a page from the back-forward cache — where the
 * document comes back with whatever inline styles and attributes it was
 * frozen with, locks included. Hence popstate and pageshow alongside it.
 */
export function useCloseOnNavigation(close: () => void) {
  const pathname = usePathname();
  const latest = useRef(close);

  useEffect(() => {
    latest.current = close;
  });

  useEffect(() => {
    latest.current();
  }, [pathname]);

  useEffect(() => {
    const onNav = () => latest.current();
    window.addEventListener("popstate", onNav);
    window.addEventListener("pageshow", onNav);
    return () => {
      window.removeEventListener("popstate", onNav);
      window.removeEventListener("pageshow", onNav);
    };
  }, []);
}
