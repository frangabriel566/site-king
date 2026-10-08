import type { Metadata } from "next";
import { getActiveBanners } from "@/lib/data/banners";
import { getCategoriesWithImages } from "@/lib/data/categories";
import { getSiteSettings } from "@/lib/data/settings";
import { getBestSellersShelf, getSectionProducts } from "@/lib/data/products";
import { sectionHref } from "@/lib/sections";
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
  const [settings, banners, categories, launches, newest, onSale, bestSellers] =
    await Promise.all([
      getSiteSettings(),
      getActiveBanners(),
      getCategoriesWithImages(),
      getSectionProducts("lancamentos", HOME_RAIL_LIMIT),
      getSectionProducts("novidades", HOME_RAIL_LIMIT),
      getSectionProducts("ofertas", HOME_RAIL_LIMIT),
      getBestSellersShelf(HOME_RAIL_LIMIT),
    ]);

  // Over the products marked for Ofertas only — one marked without a
  // promotional price simply doesn't count.
  const topDiscount = onSale.reduce<number | null>((best, product) => {
    const discount = discountPercent(product.price, product.compare_at_price);
    return discount !== null && (best === null || discount > best) ? discount : best;
  }, null);

  // Each shelf holds what was marked for it in the panel
  // (lib/data/products.ts) and renders nothing while empty. "Mais
  // vendidos" leads with its marked products and fills up with real sales.
  return (
    <>
      <BannerCarousel banners={banners} />
      <CategoryStrip categories={categories} />
      <ProductRail
        title="Lançamentos"
        products={launches}
        seeAllHref={sectionHref("lancamentos")}
      />
      <ProductRail title="Novidades" products={newest} seeAllHref={sectionHref("novidades")} />
      <BenefitsStrip settings={settings} />
      <ProductRail
        title="Ofertas"
        tag={topDiscount ? `até ${topDiscount}% off` : null}
        products={onSale}
        seeAllHref={sectionHref("ofertas")}
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
