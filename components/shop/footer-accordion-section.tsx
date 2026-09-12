"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * Columns on desktop (lg+), a collapsed accordion row below that. The
 * open/closed state only has a visual effect under lg — at lg+ the
 * content is always shown via `lg:block` regardless of `open`, so the
 * header button is inert there (`lg:pointer-events-none`).
 */
export function FooterAccordionSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center justify-between py-3.5 text-left lg:pointer-events-none lg:justify-start lg:py-0 lg:mb-4"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-bg/60">
          {title}
        </span>
        <span
          className="text-lg leading-none text-bg/50 lg:hidden"
          aria-hidden="true"
        >
          {open ? "−" : "+"}
        </span>
      </button>
      <div
        id={contentId}
        className={`${open ? "block" : "hidden"} pb-4 lg:block lg:pb-0`}
      >
        {children}
      </div>
    </div>
  );
}
