"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { COOKIE_CONSENT_KEY } from "@/lib/constants";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = window.localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!consent) setVisible(true);
    } catch {
      // localStorage unavailable — skip the banner rather than block rendering.
    }
  }, []);

  function accept() {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg px-8 py-5 md:px-12"
    >
      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="max-w-xl text-sm text-ink-muted">
          Usamos cookies para melhorar sua experiência. Ao continuar navegando,
          você concorda com nossa{" "}
          <Link href="/politica-de-privacidade" className="text-fg underline underline-offset-4 hover:text-gold">
            política de privacidade
          </Link>
          .
        </p>
        <Button onClick={accept} size="lg" className="shrink-0">
          Aceitar
        </Button>
      </div>
    </div>
  );
}
