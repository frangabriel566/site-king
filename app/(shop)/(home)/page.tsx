import type { Metadata } from "next";
import { cache } from "react";
import { getActiveBanners } from "@/lib/data/banners";
import { getCategoriesWithImages } from "@/lib/data/categories";
import { getSiteSettings } from "@/lib/data/settings";
import { getBestSellersShelf, getSectionProducts } from "@/lib/data/products";
import { sectionHref } from "@/lib/sections";
import { getHomeFeedbacks } from "@/lib/data/feedbacks";
import { FeedbackCarousel } from "@/components/shop/feedback-carousel";
import { HOME_RAIL_LIMIT } from "@/lib/constants";
import { discountPercent } from "@/lib/shop-config";
import { HomeHero } from "@/components/shop/home-hero";
import { SecondaryBanner } from "@/components/shop/secondary-banner";
import { BenefitsStrip } from "@/components/shop/benefits-strip";
import { CategoryStrip } from "@/components/shop/category-strip";
import { ProductRail } from "@/components/shop/product-rail";
import { NewsletterSection } from "@/components/shop/newsletter-section";

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
  const [settings, banners, categories, launches, newest, onSale, bestSellers, kits, feedbacks] =
    await Promise.all([
      getSiteSettings(),
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
  const whatsappDigits = settings.whatsapp?.replace(/\D/g, "") ?? "";
  const whatsappHref = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent("Olá! Vim do site da King Store.")}`
    : null;

  // Each shelf holds what was marked for it in the panel
  // (lib/data/products.ts) and renders nothing while empty. "Mais
  // vendidos" leads with its marked products and fills up with real sales.
  return (
    <>
      {/* King Store hero (out/2026): text and the two ways to buy, with the
          first banner's photo beside it. */}
      <HomeHero
        fromPrice={fromPrice}
        imageUrl={heroBanner?.image_url ?? null}
        imageAlt={heroBanner?.headline_line1 ?? "King Store"}
        whatsappHref={whatsappHref}
      />
      <CategoryStrip categories={categories} />
      <ProductRail
        title="Lançamentos"
        products={launches}
        seeAllHref={sectionHref("lancamentos")}
      />
      <ProductRail title="Novidades" products={newest} seeAllHref={sectionHref("novidades")} />
      <ProductRail title="Mais vendidos" products={bestSellers} />
      {/* KITS right below Mais vendidos (store owner's choice). */}
      <ProductRail title="KITS" products={kits} seeAllHref={sectionHref("kits")} />
      {/* Ofertas is the last product rail on purpose (store owner's choice). */}
      <ProductRail
        title="Ofertas"
        tag={topDiscount ? `até ${topDiscount}% off` : null}
        products={onSale}
        seeAllHref={sectionHref("ofertas")}
      />
      {/* Benefits strip sits after the product rails (store owner's choice). */}
      <BenefitsStrip settings={settings} />
      {/* Feedbacks marked "Exibir na home" in the panel; none, no section. */}
      {feedbacks.length > 0 && (
        <FeedbackCarousel title="O que nossos clientes dizem" feedbacks={feedbacks} />
      )}
      {/* No dedicated data source for this slot yet — the `banners` table
          has no field marking a row for it, and adding one is a schema
          change out of scope for this pass. Passing `null` keeps the
          section from rendering (no empty gap) instead of guessing which
          hero-carousel banner to reuse here. */}
      <SecondaryBanner banner={null} />
      <NewsletterSection />
    </>
  );
}
