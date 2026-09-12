"use client";

import { useEffect, useState } from "react";
import { COOKIE_CONSENT_EVENT, COOKIE_CONSENT_KEY } from "@/lib/constants";
import { WhatsAppIcon } from "./whatsapp-icon";

export function WhatsAppFloat({
  phone,
  message = "Olá! Vim do site da King Store.",
}: {
  phone: string | null;
  message?: string;
}) {
  // The cookie banner is a full-width fixed bar pinned to the same bottom
  // edge with a higher z-index — while it's up, it would sit visually on
  // top of this button. Raise this button above it until consent is
  // recorded, in this tab too (a `storage` event only fires in *other*
  // tabs, hence the custom event).
  const [raised, setRaised] = useState(false);

  useEffect(() => {
    function sync() {
      try {
        setRaised(!window.localStorage.getItem(COOKIE_CONSENT_KEY));
      } catch {
        setRaised(false);
      }
    }
    sync();
    window.addEventListener(COOKIE_CONSENT_EVENT, sync);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, sync);
  }, []);

  if (!phone) return null;

  const digits = phone.replace(/\D/g, "");
  const href = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar no WhatsApp"
      // z-index hierarchy (bottom-right corner, low to high): page content
      // (auto) < sticky header / cookie banner (z-40) < this button (z-45)
      // < drawers/dialogs (z-50, components/ui/sheet.tsx & dialog.tsx). It
      // sits above the cookie banner on purpose — see `raised` below — but
      // must stay under anything modal.
      className={`fixed right-4 z-[45] flex size-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-[transform,bottom,background-color] duration-200 ease-out hover:scale-105 hover:bg-[#20bd5a] sm:right-6 ${
        raised
          ? "bottom-[calc(env(safe-area-inset-bottom)+6.5rem)]"
          : "bottom-[calc(env(safe-area-inset-bottom)+1.25rem)]"
      }`}
    >
      <WhatsAppIcon className="size-6" />
    </a>
  );
}
