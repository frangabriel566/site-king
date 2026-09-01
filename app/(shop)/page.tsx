import type { Metadata } from "next";
import { getActiveBanner } from "@/lib/data/banners";
import { getSiteSettings } from "@/lib/data/settings";
import { getActiveCategories } from "@/lib/data/categories";
import { getFeaturedProducts, getProductBySlug } from "@/lib/data/products";
import { Hero, type HeroFeaturedProduct } from "@/components/shop/hero";
import { ProductGrid } from "@/components/shop/product-grid";
import { CategoryStrip } from "@/components/shop/category-strip";
import { EditorialBlock } from "@/components/shop/editorial-block";
import { NewsletterSection } from "@/components/shop/newsletter-section";
import type { CartItem } from "@/lib/cart/types";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "King Store — Vestuário Masculino",
  description:
    "Moletons, camisetas, calças e acessórios. Vestuário masculino editorial, feito para durar.",
};

async function resolveFeaturedProduct(
  bannerFeaturedSlug: string | undefined,
): Promise<HeroFeaturedProduct | null> {
  if (!bannerFeaturedSlug) return null;
  const product = await getProductBySlug(bannerFeaturedSlug);
  if (!product) return null;

  const image = [...product.product_images].sort(
    (a, b) => a.position - b.position,
  )[0];
  const firstInStock = product.product_variants.find((v) => v.stock > 0);

  const cartItem: CartItem | null = firstInStock
    ? {
        variantId: firstInStock.id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        color: firstInStock.color,
        size: firstInStock.size,
        price: product.price,
        image: image?.url ?? null,
        qty: 1,
      }
    : null;

  return {
    slug: product.slug,
    name: product.name,
    description: product.description,
    price: product.price,
    cartItem,
  };
}

export default async function HomePage() {
  const [banner, settings, categories, featuredProducts] = await Promise.all([
    getActiveBanner(),
    getSiteSettings(),
    getActiveCategories(),
    getFeaturedProducts(4),
  ]);

  const featuredProduct = await resolveFeaturedProduct(
    banner?.featured_product?.slug,
  );

  const editorialCategory = categories[0] ?? null;
  const editorialProducts = editorialCategory
    ? featuredProducts.find((p) => p.image)
    : null;

  return (
    <>
      <Hero
        eyebrow={banner?.eyebrow ?? null}
        headlineLine1={banner?.headline_line1 ?? null}
        headlineLine2={banner?.headline_line2 ?? null}
        wordmark={banner?.wordmark ?? null}
        ctaLabel={banner?.cta_label ?? null}
        ctaHref={banner?.cta_href ?? null}
        imageUrl={banner?.image_url ?? null}
        cutoutUrl={banner?.cutout_url ?? null}
        featuredProduct={featuredProduct}
        socialLinks={{
          instagram: settings.instagram,
          tiktok: settings.tiktok,
          youtube: settings.youtube,
        }}
        shippingNote={settings.shipping_note}
        freeShippingNote={settings.free_shipping_note}
      />

      {featuredProducts.length > 0 && (
        <section className="px-8 py-20 md:px-12">
          <div className="mb-10 flex items-end justify-between">
            <h2 className="text-heading text-3xl sm:text-4xl">Destaques</h2>
          </div>
          <ProductGrid products={featuredProducts} />
        </section>
      )}

      <CategoryStrip categories={categories} />

      {editorialCategory && (
        <EditorialBlock
          categoryName={editorialCategory.name}
          categorySlug={editorialCategory.slug}
          imageUrl={editorialProducts?.image?.url ?? null}
          imageAlt={editorialProducts?.name ?? editorialCategory.name}
        />
      )}

      <NewsletterSection />
    </>
  );
}
