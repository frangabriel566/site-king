import Link from "next/link";
import { SafeImage } from "@/components/shop/safe-image";
import type { Banner } from "@/lib/data/banners";

/**
 * A standalone promotional strip between the home page's product rails —
 * distinct from the hero carousel above (`BannerCarousel`), not a slot
 * pulled from its rotation. Renders nothing when there's no `banner`, so
 * the page never shows an empty gap where a promo would go.
 */
export function SecondaryBanner({ banner }: { banner: Banner | null }) {
  if (!banner || !banner.image_url) return null;

  const hasCopy = Boolean(banner.eyebrow || banner.headline_line1 || banner.headline_line2);

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">
      <Link
        href={banner.cta_href || "/colecao"}
        className="group relative block aspect-[16/9] w-full overflow-hidden rounded-lg bg-surface sm:aspect-[21/9]"
      >
        <SafeImage
          src={banner.image_url}
          alt={banner.headline_line1 ?? banner.wordmark ?? ""}
          fill
          sizes="(min-width: 1400px) 1400px, 100vw"
          quality={90}
          className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          fallbackLabel=""
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        {hasCopy && (
          <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-8">
            {banner.eyebrow && (
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gold">
                {banner.eyebrow}
              </p>
            )}
            {(banner.headline_line1 || banner.headline_line2) && (
              <p className="max-w-md text-xl font-bold leading-tight sm:text-2xl">
                {banner.headline_line1}
                {banner.headline_line2 && (
                  <>
                    <br />
                    {banner.headline_line2}
                  </>
                )}
              </p>
            )}
            {banner.cta_label && (
              <span className="mt-3 inline-block rounded-md bg-white px-4 py-1.5 text-xs font-semibold text-fg sm:text-sm">
                {banner.cta_label}
              </span>
            )}
          </div>
        )}
      </Link>
    </section>
  );
}
