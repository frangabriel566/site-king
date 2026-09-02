import type { Metadata } from "next";
import { getActiveBanners } from "@/lib/data/banners";
import { getSiteSettings } from "@/lib/data/settings";
import { getActiveCategories } from "@/lib/data/categories";
import {
  getFeaturedProducts,
  getNewArrivals,
  getOnSaleProducts,
  listProducts,
} from "@/lib/data/products";
import { BannerCarousel } from "@/components/shop/banner-carousel";
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
      getActiveCategories(),
      getNewArrivals(8),
      getFeaturedProducts(8),
      listProducts({ excludeBadged: true }),
      getOnSaleProducts(8),
    ]);

  return (
    <>
      <BannerCarousel banners={banners} />
      <TrustBadges freeShippingNote={settings.free_shipping_note} />
      <CategoryStrip categories={categories} />
      <ProductRail title="Lançamentos" products={newArrivals} seeAllHref="/colecao" />
      <ProductRail title="Mais vendidos" products={bestSellers} seeAllHref="/colecao" />
      <ProductRail title="Produtos" products={catalog.items.slice(0, 8)} seeAllHref="/colecao" />
      <OffersBlock products={onSale} />
      <NewsletterSection />
    </>
  );
}
