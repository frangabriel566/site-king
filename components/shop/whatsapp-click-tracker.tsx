"use client";

import { useEffect } from "react";
import { isStoreWhatsAppLink, trackWhatsAppClick, type WhatsAppOrigin } from "@/lib/analytics/events";

/**
 * Renders nothing. Counts every click on a link that opens a chat with the
 * store (`click_whatsapp`), wherever it sits: the floating button, the
 * header, the footer, the home's banners. One listener for all of them, so
 * a link added later is counted without anyone remembering to.
 *
 * The buttons that open WhatsApp from code (the WhatsApp order and the
 * checkout's WhatsApp route) are not links and track themselves.
 *
 * `data-wa-origin` on the link (or a parent) names the spot; without it,
 * the header and the footer are recognised by where the link sits.
 */
function originOf(link: HTMLAnchorElement): WhatsAppOrigin {
  const marked = link.closest<HTMLElement>("[data-wa-origin]")?.dataset.waOrigin;
  if (marked) return marked as WhatsAppOrigin;
  if (link.closest("footer")) return "rodape";
  if (link.closest("header")) return "cabecalho";
  return "pagina";
}

export function WhatsAppClickTracker() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as Element | null;
      const link = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || !isStoreWhatsAppLink(link.href)) return;
      trackWhatsAppClick(originOf(link));
    }
    // Capture: a link whose own handler stops propagation still counts.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
