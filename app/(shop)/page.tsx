import type { Metadata } from "next";
import { getActiveBanners } from "@/lib/data/banners";
import { getSiteSettings } from "@/lib/data/settings";
import { getCategoriesWithImages } from "@/lib/data/categories";
import {
  getFeaturedProducts,
  getNewArrivals,
  getOnSaleProducts,
  listProducts,
} from "@/lib/data/products";
import { HOME_RAIL_LIMIT } from "@/lib/constants";
import { BannerCarousel } from "@/components/shop/banner-carousel";
import { SecondaryBanner } from "@/components/shop/secondary-banner";
import { TrustBadges } from "@/components/shop/trust-badges";
import { CategoryStrip } from "@/components/shop/category-strip";
import { ProductRail } from "@/components/shop/product-rail";
import { OffersBlock } from "@/components/shop/offers-block";
import { NewsletterSection } from "@/components/shop/newsletter-section";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "King Store — Vestuário Masculino",
  description:
    "Moletons, camisetas, calças e acessórios. Vestuário masculino, preço em destaque.",
};

export default async function HomePage() {
  const [banners, settings, categories, newArrivals, bestSellers, catalog, onSale] =
    await Promise.all([
      getActiveBanners(),
      getSiteSettings(),
      getCategoriesWithImages(),
      getNewArrivals(HOME_RAIL_LIMIT),
      getFeaturedProducts(HOME_RAIL_LIMIT),
      listProducts({ excludeBadged: true, featuredFirst: true, limit: HOME_RAIL_LIMIT }),
      getOnSaleProducts(HOME_RAIL_LIMIT),
    ]);

  return (
    <>
      <BannerCarousel banners={banners} />
      <CategoryStrip categories={categories} />
      <ProductRail title="Lançamentos" products={newArrivals} seeAllHref="/colecao" />
      <ProductRail title="Mais vendidos" products={bestSellers} seeAllHref="/colecao" />
      {/* No dedicated data source for this slot yet — the `banners` table
          has no field marking a row for it, and adding one is a schema
          change out of scope for this pass. Passing `null` keeps the
          section from rendering (no empty gap) instead of guessing which
          hero-carousel banner to reuse here. */}
      <SecondaryBanner banner={null} />
      {/* The catch-all: everything published that no badge rail above has
          already shown. Uncapped beyond HOME_RAIL_LIMIT and newest-first,
          so a product registered in the panel is on the home as soon as it
          is published — it does not have to win a slot from the eight that
          happened to be listed first. */}
      <ProductRail title="Produtos" products={catalog.items} seeAllHref="/colecao" />
      <OffersBlock products={onSale} />
      <TrustBadges freeShippingNote={settings.free_shipping_note} />
      <NewsletterSection />
    </>
  );
}
