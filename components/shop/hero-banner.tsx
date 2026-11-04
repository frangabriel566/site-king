"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, MessageCircle, Truck } from "lucide-react";
import { BannerPhotos, type BannerPhoto } from "@/components/shop/banner-photos";
import { cn } from "@/lib/utils";
import {
  BANNER_FONTS,
  HEADLINE_SIZES,
  mainSlide,
  type BannerSlide,
  type HeroBannerData,
} from "@/lib/banner-style";

/**
 * One full-screen banner at the top of the home (Painel → Banners).
 *
 * Laid out with container queries (`@3xl:` = the banner is at least 768px
 * wide), not viewport breakpoints, so the panel's preview can show the
 * phone and the computer versions side by side at their real layout.
 * The height comes from `frameClass`: the screen minus the header on the
 * site, a fixed box in the preview.
 *
 * An editable banner can hold several slides (a photo and its texts each);
 * they take turns every few seconds, or stay on `slide` in the panel's
 * preview while that slide is being edited.
 */
export function HeroBanner({
  banner,
  whatsappHref,
  frameClass,
  priority = false,
  asHeading = false,
  slide,
}: {
  banner: HeroBannerData;
  whatsappHref: string | null;
  frameClass: string;
  priority?: boolean;
  /** The first banner carries the page's <h1>. */
  asHeading?: boolean;
  /** Panel preview: show this slide and don't rotate. */
  slide?: number;
}) {
  if (banner.kind === "pronto") return <ReadyBanner banner={banner} priority={priority} />;
  return (
    <EditableBanner
      banner={banner}
      whatsappHref={whatsappHref}
      frameClass={frameClass}
      priority={priority}
      asHeading={asHeading}
      fixedSlide={slide}
    />
  );
}

const SLIDE_MS = 6000;

function EditableBanner({
  banner,
  whatsappHref,
  frameClass,
  priority,
  asHeading,
  fixedSlide,
}: {
  banner: HeroBannerData;
  whatsappHref: string | null;
  frameClass: string;
  priority: boolean;
  asHeading: boolean;
  fixedSlide: number | undefined;
}) {
  const slides: BannerSlide[] = [mainSlide(banner), ...banner.extraSlides];
  const count = slides.length;
  const [auto, setAuto] = useState(0);
  const rotating = fixedSlide === undefined && count > 1;

  useEffect(() => {
    if (!rotating) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setAuto((index) => (index + 1) % count), SLIDE_MS);
    return () => clearInterval(timer);
  }, [rotating, count, auto]);

  const current = Math.min(fixedSlide ?? auto, count - 1);
  const slide = slides[current];

  const { style } = banner;
  const size = HEADLINE_SIZES[style.headlineSize];
  const headlineFont = BANNER_FONTS[style.headlineFont];
  const vars = {
    "--bn-bg": style.bgColor,
    "--bn-text": style.textColor,
    "--bn-highlight": style.highlightColor,
    "--bn-eyebrow": style.eyebrowColor,
    "--bn-subtitle": style.subtitleColor,
    "--bn-button": style.buttonColor,
    "--bn-button-text": style.buttonTextColor,
    "--bn-hs-m": `${size.mobile}px`,
    "--bn-hs-d": `clamp(${size.mobile}px, 6.2cqw, ${size.desktop}px)`,
  } as CSSProperties;
  const split = style.desktopLayout === "split";
  // The first slide may still have an older phone-only photo.
  const photos: (BannerPhoto | null)[] = slides.map((item, index) => {
    if (!item.image) return null;
    const mobile = index === 0 ? (banner.mobileImageUrl ?? item.image) : item.image;
    return { mobile, desktop: item.image };
  });
  const hasPhoto = photos[current] !== null;
  const alt = [slide.headline, slide.highlight].filter(Boolean).join(" ") || "King Store";
  const Heading = asHeading ? "h1" : "h2";

  return (
    <div className="@container w-full" style={vars}>
      <section
        aria-label={alt}
        className={cn(
          "relative isolate overflow-hidden bg-[var(--bn-bg)] text-[var(--bn-text)]",
          frameClass,
        )}
      >
        <BannerPhotos
          photos={photos}
          current={current}
          split={split}
          focusMobile={style.focusMobile}
          focusDesktop={style.focusDesktop}
          priority={priority}
        />
        {hasPhoto && (
          // Phone: the texts sit over the lower part of the photo; this
          // fades it into the background under them so they always read.
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 -z-10 h-[70%] @3xl:hidden"
            style={{
              background:
                "linear-gradient(to top, var(--bn-bg) 0%, var(--bn-bg) 50%, color-mix(in srgb, var(--bn-bg) 82%, transparent) 64%, color-mix(in srgb, var(--bn-bg) 35%, transparent) 84%, transparent 100%)",
            }}
          />
        )}
        {style.overlay > 0 && (
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-black"
            style={{ opacity: style.overlay / 100 }}
          />
        )}
        {!split && hasPhoto && (
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 hidden @3xl:block"
            style={{
              background:
                "linear-gradient(to right, color-mix(in srgb, var(--bn-bg) 88%, transparent) 0%, color-mix(in srgb, var(--bn-bg) 40%, transparent) 50%, transparent 75%)",
            }}
          />
        )}

        {banner.badge && (
          <p className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--bn-eyebrow)_55%,transparent)] bg-black/60 px-3 py-1.5 text-[11px] font-semibold text-[var(--bn-highlight)] @3xl:bottom-11 @3xl:right-12 @3xl:top-auto @3xl:px-[18px] @3xl:py-2.5 @3xl:text-sm">
            <Truck className="size-3.5 @3xl:size-[18px]" aria-hidden="true" />
            {banner.badge}
          </p>
        )}

        <div
          key={current}
          className="absolute inset-x-0 bottom-0 flex flex-col gap-3.5 duration-700 animate-in fade-in px-[22px] pb-9 @3xl:inset-y-0 @3xl:right-auto @3xl:w-[54%] @3xl:justify-center @3xl:gap-[22px] @3xl:pb-0 @3xl:pl-[clamp(32px,7.5cqw,112px)] @3xl:pr-6"
        >
          {(slide.eyebrow || slide.eyebrowHighlight) && (
            <p
              className="flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] @3xl:gap-4 @3xl:text-sm @3xl:tracking-[0.32em]"
              style={{ fontFamily: BANNER_FONTS[style.eyebrowFont].family }}
            >
              <span
                aria-hidden="true"
                className="block h-0.5 w-9 shrink-0 bg-[var(--bn-eyebrow)] @3xl:w-14"
              />
              <span>
                {slide.eyebrow}
                {slide.eyebrowHighlight && (
                  <>
                    {" "}
                    <span className="text-[var(--bn-eyebrow)]">{slide.eyebrowHighlight}</span>
                  </>
                )}
              </span>
            </p>
          )}
          {(slide.headline || slide.highlight) && (
            <Heading
              className={cn(
                "m-0 text-[length:var(--bn-hs-m)] leading-[0.94] tracking-[-0.01em] text-[var(--bn-text)] [overflow-wrap:anywhere] @3xl:text-[length:var(--bn-hs-d)] @3xl:leading-[0.92]",
                style.uppercase && "uppercase",
              )}
              style={{ fontFamily: headlineFont.family, fontWeight: headlineFont.heavy }}
            >
              {slide.headline}
              {slide.highlight && (
                <>
                  {" "}
                  <span className="whitespace-nowrap text-[var(--bn-highlight)]">
                    {slide.highlight}
                  </span>
                </>
              )}
            </Heading>
          )}
          {slide.subtitle && (
            <p
              className="m-0 max-w-[520px] whitespace-pre-line text-[15px] leading-[1.45] text-[var(--bn-subtitle)] @3xl:text-lg @3xl:leading-normal"
              style={{ fontFamily: BANNER_FONTS[style.bodyFont].family }}
            >
              {slide.subtitle}
            </p>
          )}
          {(slide.ctaLabel || (banner.showWhatsapp && whatsappHref)) && (
            <div className="mt-2 flex flex-col gap-2.5 @3xl:mt-2.5 @3xl:flex-row @3xl:flex-wrap @3xl:gap-3.5">
              {slide.ctaLabel && (
                <Link
                  href={slide.ctaHref}
                  className="flex h-14 items-center justify-center gap-3 rounded-xl bg-[var(--bn-button)] px-9 text-lg font-extrabold uppercase tracking-[0.12em] text-[var(--bn-button-text)] shadow-[0_10px_30px_color-mix(in_srgb,var(--bn-button)_28%,transparent)] transition-[filter] duration-150 hover:brightness-110 @3xl:h-[60px] @3xl:text-[19px]"
                  style={{ fontFamily: BANNER_FONTS[style.buttonFont].family }}
                >
                  {slide.ctaLabel}
                  <ArrowRight className="size-5" strokeWidth={2.4} aria-hidden="true" />
                </Link>
              )}
              {banner.showWhatsapp && whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-[52px] items-center justify-center gap-2.5 rounded-xl border border-[color-mix(in_srgb,var(--bn-text)_28%,transparent)] px-7 text-base font-semibold text-[var(--bn-text)] transition-colors duration-150 hover:border-[var(--bn-button)] @3xl:h-[60px] @3xl:text-[17px]"
                  style={{ fontFamily: BANNER_FONTS[style.bodyFont].family }}
                >
                  <MessageCircle className="size-5" aria-hidden="true" />
                  {banner.whatsappLabel || "Comprar pelo WhatsApp"}
                </a>
              )}
            </div>
          )}
        </div>

        {count > 1 && (
          <div className="absolute inset-x-0 bottom-1.5 flex justify-center gap-1 @3xl:bottom-5">
            {slides.map((item, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Ver foto ${index + 1}`}
                aria-current={index === current}
                onClick={() => setAuto(index)}
                className="flex size-6 items-center justify-center"
              >
                <span
                  className={cn(
                    "block h-1.5 rounded-full transition-all duration-200",
                    index === current
                      ? "w-5 bg-[var(--bn-button)]"
                      : "w-1.5 bg-[color-mix(in_srgb,var(--bn-text)_40%,transparent)]",
                  )}
                />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * A finished image: the whole picture, never cropped, linking somewhere.
 * One image serves both sizes: full width on the phone; on the computer
 * centred and no taller than the screen below the header.
 */
function ReadyBanner({ banner, priority }: { banner: HeroBannerData; priority: boolean }) {
  const desktop = banner.imageUrl ?? banner.mobileImageUrl;
  const mobile = banner.mobileImageUrl ?? banner.imageUrl;
  const alt = banner.headline || "Banner King Store";
  if (!desktop || !mobile) return null;
  const loading = priority ? "eager" : "lazy";
  const fetchPriority = priority ? "high" : "auto";
  return (
    <div className="@container w-full" style={{ backgroundColor: banner.style.bgColor }}>
      <Link href={banner.ctaHref} aria-label={alt} className="block">
        {/* Plain <img>: the image is shown at its own proportions, which
            next/image's fixed box would need to know in advance. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mobile}
          alt={alt}
          loading={loading}
          fetchPriority={fetchPriority}
          className="mx-auto block h-auto w-full @3xl:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={desktop}
          alt={alt}
          loading={loading}
          fetchPriority={fetchPriority}
          className="mx-auto hidden h-auto max-h-[min(880px,calc(100svh-150px))] w-auto max-w-full @3xl:block"
        />
      </Link>
    </div>
  );
}
