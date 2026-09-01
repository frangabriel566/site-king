import Image from "next/image";
import Link from "next/link";
import { AddToBagButton } from "./add-to-bag-button";
import { formatCurrency } from "@/lib/format";
import type { CartItem } from "@/lib/cart/types";

export type HeroFeaturedProduct = {
  slug: string;
  name: string;
  description: string | null;
  price: number;
  cartItem: CartItem | null;
};

export type HeroSocialLinks = {
  instagram?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
};

export type HeroProps = {
  eyebrow: string | null;
  headlineLine1: string | null;
  headlineLine2: string | null;
  wordmark: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string | null;
  cutoutUrl: string | null;
  featuredProduct: HeroFeaturedProduct | null;
  socialLinks: HeroSocialLinks;
  shippingNote: string | null;
  freeShippingNote: string | null;
};

export function Hero({
  eyebrow,
  headlineLine1,
  headlineLine2,
  wordmark,
  ctaLabel,
  ctaHref,
  imageUrl,
  cutoutUrl,
  featuredProduct,
  socialLinks,
  shippingNote,
  freeShippingNote,
}: HeroProps) {
  const hasSocial = Boolean(
    socialLinks.instagram || socialLinks.tiktok || socialLinks.youtube,
  );

  return (
    <section className="relative flex h-[100svh] min-h-[640px] w-full flex-col overflow-hidden bg-bg text-fg">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-[#111111]" aria-hidden="true" />
      )}
      <div className="absolute inset-0 bg-black/45" aria-hidden="true" />

      {wordmark && (
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center overflow-hidden px-4"
          aria-hidden="true"
        >
          <span
            className={`text-display whitespace-nowrap text-white ${
              cutoutUrl ? "" : "opacity-30"
            }`}
          >
            {wordmark}
          </span>
        </div>
      )}

      {cutoutUrl && (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center">
          <div className="relative h-[92%] w-full max-w-3xl">
            <Image
              src={cutoutUrl}
              alt=""
              fill
              sizes="100vw"
              className="object-contain object-bottom"
            />
          </div>
        </div>
      )}

      <div className="relative z-10 mt-auto flex flex-col gap-10 px-8 pb-24 md:flex-row md:items-end md:justify-between md:px-12 md:pb-28">
        <div className="max-w-lg">
          {eyebrow && (
            <p className="text-label mb-4 !text-white/70">{eyebrow}</p>
          )}
          {(headlineLine1 || headlineLine2) && (
            <h1 className="text-heading text-4xl text-white sm:text-5xl">
              {headlineLine1}
              <br />
              {headlineLine2}
            </h1>
          )}
          {ctaHref && ctaLabel && (
            <Link href={ctaHref} className="link-arrow mt-8 !text-white">
              {ctaLabel.replace(/\s*→\s*$/, "")}
            </Link>
          )}
        </div>

        {featuredProduct && (
          <div className="w-full max-w-xs border border-white/20 bg-black/40 p-6 backdrop-blur-sm md:w-72">
            <p className="text-sm font-medium text-white">
              {featuredProduct.name}
            </p>
            {featuredProduct.description && (
              <p className="mt-2 line-clamp-2 text-xs text-white/60">
                {featuredProduct.description}
              </p>
            )}
            <p className="mt-3 text-sm text-white">
              {formatCurrency(featuredProduct.price)}
            </p>
            <AddToBagButton
              item={featuredProduct.cartItem}
              fallbackHref={`/produto/${featuredProduct.slug}`}
              label="Adicionar à sacola"
              className="link-arrow mt-4 !text-white"
            />
          </div>
        )}
      </div>

      <div className="relative z-10 border-t border-white/15 bg-black/30 px-8 py-4 backdrop-blur-sm md:px-12">
        <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
          {hasSocial ? (
            <div className="flex items-center gap-4">
              {socialLinks.instagram && (
                <a
                  href={`https://instagram.com/${socialLinks.instagram.replace("@", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-label !text-white/70 hover:!text-gold"
                >
                  Instagram
                </a>
              )}
              {socialLinks.tiktok && (
                <a
                  href={`https://tiktok.com/${socialLinks.tiktok.replace("@", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-label !text-white/70 hover:!text-gold"
                >
                  TikTok
                </a>
              )}
              {socialLinks.youtube && (
                <a
                  href={`https://youtube.com/${socialLinks.youtube.replace("@", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-label !text-white/70 hover:!text-gold"
                >
                  YouTube
                </a>
              )}
            </div>
          ) : (
            <span />
          )}
          {shippingNote && (
            <p className="text-label !text-white/70">{shippingNote}</p>
          )}
          {freeShippingNote && (
            <p className="text-label !text-white/70">{freeShippingNote}</p>
          )}
        </div>
      </div>
    </section>
  );
}
