"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Long enough to read a 90-character message twice. */
const ROTATE_MS = 5000;

/**
 * The rotating line at the very top of the header — the store's messages
 * from Configurações → Faixa de avisos (or the free-shipping line when
 * there are none; see announcementMessages in lib/shop-config).
 *
 * Every message is rendered, stacked in the same box, and only the active
 * one is visible: the bar never changes height or width while it rotates,
 * which the sticky header around it depends on (see header.tsx).
 *
 * It stops on its own while the pointer or keyboard focus is on it and
 * while the tab is hidden, and for good once the shopper uses the arrows —
 * moving text has to be pausable (WCAG 2.2.2), and someone stepping
 * through the messages by hand doesn't want them moving under them.
 */
export function AnnouncementBar({ messages }: { messages: string[] }) {
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const [stopped, setStopped] = useState(false);
  const count = messages.length;
  const rotating = count > 1;

  useEffect(() => {
    if (!rotating || held || stopped) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setIndex((i) => (i + 1) % count);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [rotating, held, stopped, count]);

  if (count === 0) return null;

  function step(direction: 1 | -1) {
    setStopped(true);
    setIndex((i) => (i + direction + count) % count);
  }

  return (
    <section
      aria-label="Avisos da loja"
      className="flex min-w-0 flex-1 items-center justify-center sm:flex-none"
      onPointerEnter={(event) => {
        // A touch "enter" has no matching leave until the next tap
        // elsewhere, which would freeze the bar for no reason.
        if (event.pointerType === "mouse") setHeld(true);
      }}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      {rotating && <BarArrow side="left" onClick={() => step(-1)} />}
      <div className="relative h-9 min-w-0 flex-1 overflow-hidden sm:w-[26rem] sm:flex-none">
        {messages.map((message, i) => {
          const active = i === index;
          return (
            <p
              key={i}
              aria-hidden={!active}
              className={`absolute inset-0 flex items-center justify-center px-1 text-center transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none ${
                active ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0"
              }`}
            >
              <span className="truncate">{message}</span>
            </p>
          );
        })}
      </div>
      {rotating && <BarArrow side="right" onClick={() => step(1)} />}
    </section>
  );
}

function BarArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Aviso anterior" : "Próximo aviso"}
      className="flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center text-bg/70 transition-colors duration-150 ease-out hover:text-gold"
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
