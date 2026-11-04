import type { Metadata } from "next";
import { cache } from "react";
import { getActiveBanners, toHeroBanner } from "@/lib/data/banners";
import { getCategoriesWithImages } from "@/lib/data/categories";
import { getSiteSettings } from "@/lib/data/settings";
import { getHomeSettings, homeText } from "@/lib/data/home";
import { formatCurrency } from "@/lib/format";
import {
  getBestSellersShelf,
  getProductListItemById,
  getSectionProducts,
} from "@/lib/data/products";
import { sectionHref } from "@/lib/sections";
import { getHomeFeedbacks } from "@/lib/data/feedbacks";
import { FeedbackCarousel } from "@/components/shop/feedback-carousel";
import { HOME_RAIL_LIMIT } from "@/lib/constants";
import { discountPercent } from "@/lib/shop-config";
import { HeroBanners } from "@/components/shop/hero-banners";
import {
  DEFAULT_BANNER_STYLE,
  DEFAULT_BANNER_TEXTS,
  mainSlide,
  type HeroBannerData,
} from "@/lib/banner-style";
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

  // The KITS block: the product picked in Página inicial, else the
  // shelf's first.
  const pickedKit = home.kit_product_id ? await getProductListItemById(home.kit_product_id) : null;
  const kit = pickedKit ?? kits[0] ?? null;

  // Over the products marked for Ofertas only — one marked without a
  // promotional price simply doesn't count.
  const topDiscount = onSale.reduce<number | null>((best, product) => {
    const discount = discountPercent(product.price, product.compare_at_price);
    return discount !== null && (best === null || discount > best) ? discount : best;
  }, null);

  // "a partir de R$ X" in the default banner: the cheapest product on any shelf.
  const shelfPrices = [...launches, ...newest, ...onSale, ...bestSellers, ...kits]
    .map((product) => product.price)
    .filter((price) => price > 0);
  const fromPrice = shelfPrices.length > 0 ? Math.min(...shelfPrices) : null;
  // The top of the home: the active banners from Painel → Banners. With
  // none switched on, the approved art with the texts and photo from
  // Painel → Página inicial, so the top is never empty.
  const homeRow = home.row;
  const fallbackBanner: HeroBannerData = {
    id: "padrao",
    kind: "editavel",
    eyebrow: homeText(homeRow, "eyebrow"),
    eyebrowHighlight: homeText(homeRow, "eyebrow_highlight"),
    headline: homeText(homeRow, "headline"),
    highlight:
      homeRow?.headline_highlight?.trim() ||
      (fromPrice !== null ? formatCurrency(fromPrice) : ""),
    subtitle: homeText(homeRow, "subtitle"),
    ctaLabel: homeText(homeRow, "cta_label"),
    ctaHref: homeText(homeRow, "cta_href"),
    showWhatsapp: true,
    whatsappLabel: homeText(homeRow, "whatsapp_label"),
    badge: DEFAULT_BANNER_TEXTS.badge,
    imageUrl: home.images.hero_image_url,
    mobileImageUrl: null,
    extraSlides: [],
    style: DEFAULT_BANNER_STYLE,
  };
  // A banner from before the full-screen ones (no style saved yet) only
  // had a photo: it shows that photo with the default banner's texts
  // until it is saved again in the panel.
  const heroBanners =
    banners.length > 0
      ? banners.map((row) => {
          const banner = toHeroBanner(row);
          if (banner.kind === "pronto" || row.style) return banner;
          return {
            ...fallbackBanner,
            id: banner.id,
            imageUrl: banner.imageUrl,
            mobileImageUrl: banner.mobileImageUrl,
            // Their extra photos (first version) carry the default texts.
            extraSlides: banner.extraSlides.map((slide) => ({
              ...mainSlide(fallbackBanner),
              image: slide.image,
            })),
          };
        })
      : [fallbackBanner];
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
      <HeroBanners banners={heroBanners} whatsappHref={whatsappHref} />
      <BenefitsStrip settings={settings} />
      <CategoryStrip categories={categories} />
      <ProductRail
        title="Lançamentos"
        products={launches}
        seeAllHref={sectionHref("lancamentos")}
      />
      <ProductRail title="Novidades" products={newest} seeAllHref={sectionHref("novidades")} />
      <ProductRail title="Mais vendidos" products={bestSellers} />
      {kit && (
        <KitBanner
          kit={kit}
          kitCount={kits.length}
          seeAllHref={sectionHref("kits")}
          installmentsMax={settings.installments_max}
          imageUrl={home.images.kit_image_url}
          title={home.kit_title}
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
