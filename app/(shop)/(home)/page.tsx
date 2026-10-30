import type { Metadata } from "next";
import { cache } from "react";
import { getActiveBanners } from "@/lib/data/banners";
import { getCategoriesWithImages } from "@/lib/data/categories";
import { getSiteSettings } from "@/lib/data/settings";
import { getHomeSettings, homeText } from "@/lib/data/home";
import { formatCurrency } from "@/lib/format";
import { getBestSellersShelf, getSectionProducts } from "@/lib/data/products";
import { sectionHref } from "@/lib/sections";
import { getHomeFeedbacks } from "@/lib/data/feedbacks";
import { FeedbackCarousel } from "@/components/shop/feedback-carousel";
import { HOME_RAIL_LIMIT } from "@/lib/constants";
import { discountPercent } from "@/lib/shop-config";
import { HomeHero } from "@/components/shop/home-hero";
import { BenefitsStrip } from "@/components/shop/benefits-strip";
import { CategoryStrip } from "@/components/shop/category-strip";
import { ProductRail } from "@/components/shop/product-rail";
import { NewsletterSection } from "@/components/shop/newsletter-section";
import { KitBanner } from "@/components/shop/kit-banner";

// One query per request: the metadata and the page both need the banners.
const activeBanners = cache(getActiveBanners);

const HOME_DESCRIPTION =
  "Moletons, camisetas, calças e acessórios. Vestuário masculino, preço em destaque.";

export async function generateMetadata(): Promise<Metadata> {
  // The link card on WhatsApp/Instagram: the first hero banner's photo,
  // else the store logo. Before, the home had no og:image at all and a
  // shared link went out as a bare line of text.
  const [banners, settings] = await Promise.all([activeBanners(), getSiteSettings()]);
  const ogImage = banners.find((banner) => banner.image_url)?.image_url ?? settings.logo_url;
  return {
    // absolute: the root layout's "%s — King Store" template would
    // otherwise repeat the store name ("King Store — … — King Store").
    title: { absolute: "King Store — Vestuário Masculino" },
    description: HOME_DESCRIPTION,
    openGraph: {
      title: "King Store — Vestuário Masculino",
      description: HOME_DESCRIPTION,
      ...(ogImage ? { images: [{ url: ogImage, alt: "King Store" }] } : {}),
    },
    twitter: { card: ogImage ? "summary_large_image" : "summary" },
  };
}

export default async function HomePage() {
  const [settings, home, banners, categories, launches, newest, onSale, bestSellers, kits, feedbacks] =
    await Promise.all([
      getSiteSettings(),
      getHomeSettings(),
      activeBanners(),
      getCategoriesWithImages(),
      getSectionProducts("lancamentos", HOME_RAIL_LIMIT),
      getSectionProducts("novidades", HOME_RAIL_LIMIT),
      getSectionProducts("ofertas", HOME_RAIL_LIMIT),
      getBestSellersShelf(HOME_RAIL_LIMIT),
      getSectionProducts("kits", HOME_RAIL_LIMIT),
      getHomeFeedbacks(),
    ]);

  // Over the products marked for Ofertas only — one marked without a
  // promotional price simply doesn't count.
  const topDiscount = onSale.reduce<number | null>((best, product) => {
    const discount = discountPercent(product.price, product.compare_at_price);
    return discount !== null && (best === null || discount > best) ? discount : best;
  }, null);

  // "a partir de R$ X" in the hero: the cheapest product on any shelf.
  const shelfPrices = [...launches, ...newest, ...onSale, ...bestSellers, ...kits]
    .map((product) => product.price)
    .filter((price) => price > 0);
  const fromPrice = shelfPrices.length > 0 ? Math.min(...shelfPrices) : null;
  const heroBanner = banners.find((banner) => banner.image_url) ?? null;
  // The card over the hero photo: the product picked in Página inicial,
  // else the banner's own featured product, else the first launch, so the
  // card is there as in the approved layout even before one is picked.
  const firstLaunch = launches[0] ?? bestSellers[0] ?? null;
  const heroFeatured =
    home.featured_product ??
    heroBanner?.featured_product ??
    (firstLaunch
      ? {
          id: firstLaunch.id,
          slug: firstLaunch.slug,
          name: firstLaunch.name,
          description: null,
          price: firstLaunch.price,
          compare_at_price: firstLaunch.compare_at_price,
        }
      : null);
  const homeRow = home.row;
  const heroTexts = {
    eyebrow: homeText(homeRow, "eyebrow"),
    eyebrowHighlight: homeText(homeRow, "eyebrow_highlight"),
    headline: homeText(homeRow, "headline"),
    headlineHighlight:
      homeRow?.headline_highlight?.trim() ||
      (fromPrice !== null ? formatCurrency(fromPrice) : null),
    subtitle: homeText(homeRow, "subtitle"),
    ctaLabel: homeText(homeRow, "cta_label"),
    ctaHref: homeText(homeRow, "cta_href"),
    whatsappLabel: homeText(homeRow, "whatsapp_label"),
  };
  // The panel's card title belongs to the product picked there; it isn't
  // put on a fallback product the store owner didn't choose.
  const heroFeaturedLabel =
    home.featured_product && homeRow?.featured_label?.trim()
      ? homeRow.featured_label.trim()
      : null;
  const whatsappDigits = settings.whatsapp?.replace(/\D/g, "") ?? "";
  const whatsappHref = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent("Olá! Vim do site da King Store.")}`
    : null;

  // The King Store layout (out/2026), top to bottom: hero, benefits,
  // categories, the shelves with the kit banner between "Mais vendidos" and
  // "Ofertas" (Ofertas stays last, store owner's choice), reviews and the
  // newsletter. Each shelf renders nothing while empty.
  return (
    <>
      <HomeHero
        texts={heroTexts}
        imageUrl={heroBanner?.image_url ?? null}
        imageAlt={heroBanner?.headline_line1 ?? "King Store"}
        featured={heroFeatured}
        featuredLabel={heroFeaturedLabel}
        whatsappHref={whatsappHref}
      />
      <BenefitsStrip settings={settings} />
      <CategoryStrip categories={categories} />
      <ProductRail
        title="Lançamentos"
        products={launches}
        seeAllHref={sectionHref("lancamentos")}
      />
      <ProductRail title="Novidades" products={newest} seeAllHref={sectionHref("novidades")} />
      <ProductRail title="Mais vendidos" products={bestSellers} />
      {kits.length > 0 && (
        <KitBanner
          kit={kits[0]}
          kitCount={kits.length}
          seeAllHref={sectionHref("kits")}
          installmentsMax={settings.installments_max}
        />
      )}
      <ProductRail
        title="Ofertas"
        tag={topDiscount ? `até ${topDiscount}% off` : null}
        products={onSale}
        seeAllHref={sectionHref("ofertas")}
      />
      {feedbacks.length > 0 && (
        <FeedbackCarousel title="O que nossos clientes dizem" feedbacks={feedbacks} />
      )}
      <NewsletterSection />
    </>
  );
}
