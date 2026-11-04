"use client";

import { SafeImage } from "@/components/shop/safe-image";
import { cn } from "@/lib/utils";

export type BannerPhoto = { mobile: string; desktop: string };

/**
 * The background photos of an editable banner's slides, stacked: the
 * `current` one shows and the others fade out (HeroBanner moves it).
 * Laid out like the rest of the banner with container queries: the phone version on top, fading down; the computer
 * one on the right ("split") or across the whole banner.
 */
export function BannerPhotos({
  photos,
  current,
  split,
  focusMobile,
  focusDesktop,
  priority,
}: {
  photos: (BannerPhoto | null)[];
  current: number;
  split: boolean;
  focusMobile: number;
  focusDesktop: number;
  priority: boolean;
}) {
  return (
    <>
      {photos.map((photo, index) => {
        if (!photo) return null;
        const visible = index === current;
        const layer = cn(
          "transition-opacity duration-1000 ease-in-out motion-reduce:transition-none",
          visible ? "opacity-100" : "opacity-0",
        );
        return (
          <div key={`${index}-${photo.desktop}`} aria-hidden={!visible}>
            <div
              className={cn(
                "absolute inset-x-0 top-0 -z-10 h-[78%] [mask-image:linear-gradient(to_bottom,#000_60%,transparent_100%)] @3xl:hidden",
                layer,
              )}
            >
              <SafeImage
                src={photo.mobile}
                alt=""
                fill
                priority={priority && index === 0}
                sizes="100vw"
                fallbackLabel=""
                className="object-cover"
                style={{ objectPosition: `50% ${focusMobile}%` }}
              />
            </div>
            <div
              className={cn(
                "absolute inset-y-0 right-0 -z-10 hidden @3xl:block",
                split
                  ? "w-[62%] [mask-image:linear-gradient(to_right,transparent_0%,#000_30%)]"
                  : "w-full",
                layer,
              )}
            >
              <SafeImage
                src={photo.desktop}
                alt=""
                fill
                priority={priority && index === 0}
                sizes={split ? "62vw" : "100vw"}
                fallbackLabel=""
                className="object-cover"
                style={{ objectPosition: `50% ${focusDesktop}%` }}
              />
            </div>
          </div>
        );
      })}
    </>
  );
}
