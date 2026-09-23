"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Anything that can still legitimately be holding the document hostage.
 *
 * Radix gives every portalled surface a role, and that is what is
 * checked rather than a class or a `data-slot`: a dialog, a sheet, an
 * alert dialog, a menu, a select or a popover is entitled to have the
 * body locked while it is on screen, including through its exit
 * animation, when it is still mounted. If any of them is present the
 * guard does nothing at all.
 */
const OWNED_BY_AN_OVERLAY = [
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="menu"]',
  '[role="listbox"]',
  "[data-radix-popper-content-wrapper]",
].join(",");

/**
 * Releases a scroll/pointer lock that nothing owns any more.
 *
 * Two separate libraries lock the document when a drawer opens, and they
 * do it in two different ways: Radix writes `pointer-events: none`
 * straight onto `document.body`, and react-remove-scroll sets
 * `body[data-scroll-locked]`, which an injected stylesheet turns into
 * `overflow: hidden !important; position: relative !important`. Both are
 * released from React effect cleanups, so both depend on that cleanup
 * actually running. A component torn down mid-transition, a bfcache
 * restore that brings the attributes back from a frozen document, an
 * exit animation interrupted by a route change — any of these can leave
 * one of the two behind, and then the page looks completely normal while
 * refusing to scroll or accept a single tap. Only a reload clears it.
 *
 * The rest of this fix makes sure the drawers close on navigation, which
 * is what actually caused it. This is the net underneath: it asserts the
 * invariant directly — no overlay mounted means no lock — so no future
 * path can strand the page again, whatever the mechanism.
 *
 * It is not a poll. It reacts to the DOM changing, to history moves and
 * to the page being restored or refocused, and in the normal case it
 * finds nothing to do and returns immediately.
 */
export function OverlayGuard() {
  const pathname = usePathname();

  useEffect(() => {
    const release = () => {
      if (document.querySelector(OWNED_BY_AN_OVERLAY)) return;

      const body = document.body;
      if (body.style.pointerEvents === "none") body.style.pointerEvents = "";
      if (body.hasAttribute("data-scroll-locked")) {
        body.removeAttribute("data-scroll-locked");
      }
      // react-remove-scroll parks this on whichever element it froze.
      for (const el of document.querySelectorAll(".with-scroll-bars-hidden")) {
        el.classList.remove("with-scroll-bars-hidden");
      }
    };

    release();

    // Only body's own attributes and the subtree's membership matter: an
    // overlay appearing or disappearing, or the lock being written.
    const observer = new MutationObserver(release);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "data-scroll-locked", "class"],
    });

    window.addEventListener("pageshow", release);
    window.addEventListener("popstate", release);
    document.addEventListener("visibilitychange", release);
    return () => {
      observer.disconnect();
      window.removeEventListener("pageshow", release);
      window.removeEventListener("popstate", release);
      document.removeEventListener("visibilitychange", release);
    };
  }, [pathname]);

  return null;
}
