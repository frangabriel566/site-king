import type { Metadata } from "next";
import { getActiveBanners } from "@/lib/data/banners";
import { getCategoriesWithImages } from "@/lib/data/categories";
import { getSiteSettings } from "@/lib/data/settings";
import {
  getBestSellers,
  getDiscountedProducts,
  getNewestProducts,
} from "@/lib/data/products";
import { HOME_RAIL_LIMIT } from "@/lib/constants";
import { discountPercent } from "@/lib/shop-config";
import { BannerCarousel } from "@/components/shop/banner-carousel";
import { SecondaryBanner } from "@/components/shop/secondary-banner";
import { BenefitsStrip } from "@/components/shop/benefits-strip";
import { CategoryStrip } from "@/components/shop/category-strip";
import { ProductRail } from "@/components/shop/product-rail";
import { NewsletterSection } from "@/components/shop/newsletter-section";

export const metadata: Metadata = {
  title: "King Store — Vestuário Masculino",
  description:
    "Moletons, camisetas, calças e acessórios. Vestuário masculino, preço em destaque.",
};

export default async function HomePage() {
  const [settings, banners, categories, newest, onSale, bestSellers] = await Promise.all([
    getSiteSettings(),
    getActiveBanners(),
    getCategoriesWithImages(),
    getNewestProducts(HOME_RAIL_LIMIT),
    getDiscountedProducts(HOME_RAIL_LIMIT),
    getBestSellers(HOME_RAIL_LIMIT),
  ]);

  // The rail is sorted by discount, so its first product has the biggest.
  const topDiscount = onSale[0]
    ? discountPercent(onSale[0].price, onSale[0].compare_at_price)
    : null;

  // Every rail below is worked out from the data (lib/data/products.ts)
  // and renders nothing while empty — "Mais vendidos" stays hidden until
  // the store has its first confirmed sale.
  return (
    <>
      <BannerCarousel banners={banners} />
      <CategoryStrip categories={categories} />
      <ProductRail
        title="Novidades"
        products={newest}
        seeAllHref="/colecao?ordenar=novidades"
      />
      <BenefitsStrip settings={settings} />
      <ProductRail
        title="Ofertas"
        tag={topDiscount ? `até ${topDiscount}% off` : null}
        products={onSale}
        seeAllHref="/colecao?promocao=1"
      />
      <ProductRail title="Mais vendidos" products={bestSellers} />
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
