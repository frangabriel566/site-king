"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type SyntheticEvent } from "react";
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
 *
 * The failed `<img>` is hidden while the next step waits, and every step
 * gets a fresh element. Leaving it up is what showed the broken icon and
 * the alt text ("Frente") for the whole retry window — the delay below plus
 * the second request, ~1.5s on the product page — and on the same element
 * the alt text would have stayed visible even after the retry: `next/image`
 * turns it on at the first error and never turns it back off.
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

type State = {
  src: string;
  stage: Stage;
  /** This step failed and the next one is waiting out RETRY_DELAY_MS. */
  errored: boolean;
  /** `revealing` is the fade-in running, with the placeholder still under
   * the photo so the fade never passes through an empty box. */
  phase: "loading" | "revealing" | "shown";
};

function initialState(src: string, stage: Stage = "optimized"): State {
  return { src, stage, errored: false, phase: "loading" };
}

export type SafeImageProps = Omit<ImageProps, "src" | "onError"> & {
  src: string;
  /** Label for the box that replaces the photo when even the CDN fails. */
  fallbackLabel?: string;
  /**
   * Never show a half-loaded photo: a placeholder holds the box while it
   * loads, and the photo fades in once it has fully arrived. The
   * placeholder covers the parent box, so this is for `fill` images.
   */
  reveal?: boolean;
  /** With `reveal`: a file the browser already has — the listing card's
   * copy of this same photo — shown in place of the skeleton. */
  placeholderSrc?: string;
};

function withRetryParam(url: string) {
  return `${url}${url.includes("?") ? "&" : "?"}retry=1`;
}

const subscribeNothing = () => () => {};

export function SafeImage({
  src,
  alt,
  fallbackLabel = "Sem imagem",
  reveal = false,
  placeholderSrc,
  onLoad,
  ...props
}: SafeImageProps) {
  const [state, setState] = useState<State>(() => initialState(src));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Whether this instance arrived in the server's HTML: hydration reads the
  // server snapshot (false), anything mounted afterwards — a client-side
  // navigation, a slide rendered later — reads true. A server-rendered photo
  // is being downloaded, and possibly painted, before React even runs;
  // hiding it until hydration would hold the page's main image hostage to
  // the JavaScript bundle. It paints over its placeholder as it arrives
  // instead, and only photos mounted on the client wait and fade in.
  const clientRender = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [fadeIn] = useState(() => reveal && clientRender);

  // A new photo in the same slot — another color, another product in a
  // recycled card — starts its own escalation instead of inheriting the
  // previous one's, which would send it straight to the fallback.
  if (state.src !== src) setState(initialState(src));

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function handleLoad(event: SyntheticEvent<HTMLImageElement>) {
    // next/image replays `load` for a photo that settled before hydration,
    // and a failed one is `complete` too — only a decoded bitmap counts.
    if (event.currentTarget.naturalWidth === 0) return;
    // A failed element can still come through before its retry is due —
    // next/image re-requests its src whenever it re-attaches — and then it
    // has the photo: show it instead of throwing it away for the next step.
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setState((prev) =>
      prev.src === src && prev.phase === "loading"
        ? { ...prev, errored: false, phase: fadeIn ? "revealing" : "shown" }
        : prev,
    );
    onLoad?.(event);
  }

  function handleError() {
    const next = NEXT_STAGE[state.stage];
    if (next === state.stage) return;
    if (next === "failed") {
      setState(initialState(src, "failed"));
      return;
    }
    setState((prev) => (prev.src === src ? { ...prev, errored: true } : prev));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      // The photo may have been swapped out while we waited; that new one
      // is running its own escalation and must not be knocked back.
      setState((prev) => (prev.src === src ? initialState(src, next) : prev));
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

  const hidden = state.errored || (fadeIn && state.phase === "loading");

  return (
    <>
      {reveal && props.fill && state.phase !== "shown" &&
        (placeholderSrc ? (
          // Already in the browser cache, so it is on screen in the first
          // frame; `unoptimized` because it is an optimizer URL already.
          <Image
            src={placeholderSrc}
            alt=""
            fill
            unoptimized
            loading="eager"
            decoding="sync"
            className="object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="absolute inset-0 animate-pulse bg-surface-2 motion-reduce:animate-none"
          />
        ))}
      <Image
        {...props}
        key={state.stage}
        alt={alt}
        src={state.stage === "retry" ? withRetryParam(src) : src}
        unoptimized={state.stage === "direct" ? true : props.unoptimized}
        className={cn(props.className, fadeIn && state.phase !== "loading" && "safe-image-reveal")}
        style={hidden ? { ...props.style, opacity: 0 } : props.style}
        onLoad={handleLoad}
        onError={handleError}
        onAnimationEnd={(event) => {
          props.onAnimationEnd?.(event);
          if (event.animationName === "safe-image-reveal") {
            setState((prev) => (prev.src === src ? { ...prev, phase: "shown" } : prev));
          }
        }}
      />
    </>
  );
}
