import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { SafeImage } from "@/components/shop/safe-image";
import { formatCurrency } from "@/lib/format";
import type { FeaturedBannerProduct } from "@/lib/data/banners";

/**
 * The top of the home page in the King Store layout (out/2026): the
 * "Vista-se como um rei" line, a headline with the lowest price on the
 * shelves, and the two ways to buy side by side. The photo is the first
 * active banner's (Banners in the panel), so swapping it needs no deploy;
 * with no banner the text simply takes the full width.
 */
export type HomeHeroTexts = {
  eyebrow: string;
  eyebrowHighlight: string;
  headline: string;
  /** The gold end of the headline: the panel's text, else the lowest
   * shelf price, else nothing. */
  headlineHighlight: string | null;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  whatsappLabel: string;
};

/** Texts from Painel → Página inicial (lib/data/home.ts). */
export function HomeHero({
  texts,
  imageUrl,
  imageAlt,
  featured,
  featuredLabel,
  whatsappHref,
}: {
  texts: HomeHeroTexts;
  imageUrl: string | null;
  imageAlt: string;
  /** The banner's featured product (Banners → Produto em destaque): its
   * name and price float over the photo and open the product. */
  featured: FeaturedBannerProduct | null;
  /** Card title from the panel; null shows the product's name. */
  featuredLabel: string | null;
  whatsappHref: string | null;
}) {
  return (
    <section className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-10 px-4 pb-10 pt-10 md:px-8 md:pt-14">
      <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-5">
        <p className="flex items-center gap-3.5 font-label text-[11px] tracking-[0.22em] text-fg sm:text-xs">
          <span
            aria-hidden="true"
            className="h-0.5 w-12 shrink-0 bg-gold-text shadow-[0_0_12px_rgba(205,169,107,0.8)]"
          />
          {texts.eyebrow}
          {texts.eyebrowHighlight && (
            <>
              {" "}
              <span className="text-gold-text">{texts.eyebrowHighlight}</span>
            </>
          )}
        </p>
        <h1 className="!text-[clamp(2.75rem,9vw,4rem)] !font-black leading-[0.98]">
          {texts.headline}
          {texts.headlineHighlight && (
            <>
              {" "}
              <span className="text-gold-text">{texts.headlineHighlight}</span>
            </>
          )}
        </h1>
        <p className="max-w-[520px] text-base leading-relaxed text-muted-foreground sm:text-lg">
          {texts.subtitle}
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link
            href={texts.ctaHref}
            className="bg-buy inline-flex min-h-[52px] items-center gap-2.5 rounded-[10px] px-7 font-display text-[17px] font-extrabold tracking-[0.06em] text-on-buy transition-colors duration-150 ease-out hover:bg-buy-hover"
          >
            {texts.ctaLabel}
            <ArrowRight className="size-[18px]" aria-hidden="true" />
          </Link>
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[52px] items-center gap-2.5 rounded-[10px] border border-line-strong px-6 text-[15px] font-semibold transition-colors duration-150 ease-out hover:border-gold"
            >
              <MessageCircle className="size-[18px]" aria-hidden="true" />
              {texts.whatsappLabel}
            </a>
          )}
        </div>
      </div>

      {imageUrl && (
        <div className="relative min-w-0 flex-[1_1_380px]">
          <div className="relative aspect-[4/5] max-h-[560px] overflow-hidden rounded-2xl border border-gold shadow-[0_0_60px_rgba(205,169,107,0.22)]">
            <SafeImage
              src={imageUrl}
              alt={imageAlt}
              fill
              priority
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
          </div>
          {featured && (
            <Link
              href={`/produto/${featured.slug}`}
              className="absolute bottom-7 left-3 flex flex-col gap-0.5 rounded-xl border border-line bg-bg/95 px-4 py-3 transition-colors duration-150 ease-out hover:border-gold sm:-left-3"
            >
              <span className="text-xs text-muted-foreground">{featuredLabel ?? featured.name}</span>
              <span className="font-display text-2xl font-extrabold leading-tight">
                {formatCurrency(featured.price)}
              </span>
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
