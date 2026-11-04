"use client";

import { SafeImage } from "@/components/shop/safe-image";
import { cn } from "@/lib/utils";
import imageLoader from "@/lib/image-loader";

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
            {split ? (
              // Computer, photo on the right: the whole photo at the
              // banner's height, nothing cut off — a portrait photo shows
              // head to hem. Only a photo wider than two thirds of the
              // banner is trimmed at the sides (by `focusDesktop`). Kept off
              // the right edge by the same margin the texts keep on the left.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageLoader({ src: photo.desktop, width: 1600 })}
                alt=""
                loading={priority && index === 0 ? "eager" : "lazy"}
                className={cn(
                  "absolute inset-y-0 right-[clamp(24px,7cqw,112px)] -z-10 hidden h-full w-auto max-w-[66%] object-cover [mask-image:linear-gradient(to_right,transparent_0%,#000_22%,#000_94%,transparent_100%)] @3xl:block",
                  layer,
                )}
                style={{ objectPosition: `${focusDesktop}% 50%` }}
              />
            ) : (
              <div
                className={cn("absolute inset-0 -z-10 hidden @3xl:block", layer)}
              >
                <SafeImage
                  src={photo.desktop}
                  alt=""
                  fill
                  priority={priority && index === 0}
                  sizes="100vw"
                  fallbackLabel=""
                  className="object-cover"
                  style={{ objectPosition: `50% ${focusDesktop}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
