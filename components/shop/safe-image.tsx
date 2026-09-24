"use client";

import { useEffect, useRef, useState } from "react";
import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

/**
 * `next/image` that recovers from a failed load instead of leaving a
 * broken-image icon on the page.
 *
 * Every storefront photo goes through Next's optimizer, which downloads
 * the file from Supabase Storage on a cold cache and gives up if that
 * download takes more than 7s (the timeout lives in Next itself, see
 * `next/dist/server/image-optimizer.js`). A product page fires ~20 of
 * those requests at once, so one network hiccup is enough for a single
 * response to come back 504 — and from there the `<img>` keeps the error
 * forever, showing the browser's broken icon plus the `alt` text, because
 * `next/image` never retries on its own. That is the "some photos load,
 * some don't, reload and it's a different set" symptom.
 *
 * Each failure escalates one step:
 *   1. normal optimized request;
 *   2. the same request with `?retry=1` — a different URL, so neither the
 *      browser's cached failure nor the optimizer's on-disk cache entry
 *      can hand back the same error;
 *   3. `unoptimized` — straight from the Supabase CDN, skipping the
 *      optimizer entirely. Uploads are already WebP capped at 2560px
 *      (see `lib/client-upload.ts`), so the raw file is a fair last
 *      resort rather than a 5MB original.
 * Only after all three does the gray "Sem imagem" box take over, which is
 * at least a deliberate empty state instead of a broken icon.
 */

// Long enough for a congested connection to clear: retrying in the same
// instant usually lands in the same congestion that caused the failure.
const RETRY_DELAY_MS = 600;

type Stage = "optimized" | "retry" | "direct" | "failed";

const NEXT_STAGE: Record<Stage, Stage> = {
  optimized: "retry",
  retry: "direct",
  direct: "failed",
  failed: "failed",
};

export type SafeImageProps = Omit<ImageProps, "src" | "onError"> & {
  src: string;
  /** Label for the box that replaces the photo when even the CDN fails. */
  fallbackLabel?: string;
};

function withRetryParam(url: string) {
  return `${url}${url.includes("?") ? "&" : "?"}retry=1`;
}

export function SafeImage({ src, alt, fallbackLabel = "Sem imagem", ...props }: SafeImageProps) {
  const [state, setState] = useState<{ src: string; stage: Stage }>({ src, stage: "optimized" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A new photo in the same slot — another color, another product in a
  // recycled card — starts its own escalation instead of inheriting the
  // previous one's, which would send it straight to the fallback.
  if (state.src !== src) setState({ src, stage: "optimized" });

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function handleError() {
    const next = NEXT_STAGE[state.stage];
    if (next === state.stage) return;
    if (next === "failed") {
      setState({ src, stage: "failed" });
      return;
    }
    timer.current = setTimeout(() => {
      // The photo may have been swapped out while we waited; that new one
      // is running its own escalation and must not be knocked back.
      setState((prev) => (prev.src === src ? { src, stage: next } : prev));
    }, RETRY_DELAY_MS);
  }

  if (state.stage === "failed") {
    return (
      <span
        // A decorative photo (alt="") stays decorative when it fails: the
        // gallery thumbnails sit next to a main image that already carries
        // the description, so announcing "Sem imagem" three more times only
        // adds noise for a screen reader.
        role={alt ? "img" : undefined}
        aria-hidden={alt ? undefined : true}
        aria-label={alt || undefined}
        className={cn(
          "flex items-center justify-center bg-surface px-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
          // `fill` images sit in a `relative` box that has no size of its
          // own until something fills it, so the placeholder has to cover
          // the box the same way the photo would have.
          props.fill && "absolute inset-0",
          props.className,
        )}
        style={props.fill ? undefined : { width: props.width, height: props.height }}
      >
        {fallbackLabel}
      </span>
    );
  }

  return (
    <Image
      {...props}
      alt={alt}
      src={state.stage === "retry" ? withRetryParam(src) : src}
      unoptimized={state.stage === "direct" ? true : props.unoptimized}
      onError={handleError}
    />
  );
}
