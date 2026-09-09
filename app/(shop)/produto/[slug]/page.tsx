import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getAllActiveProductSlugs,
  getProductBySlug,
  getRelatedProducts,
} from "@/lib/data/products";
import { getSiteSettings } from "@/lib/data/settings";
import { getProductReviews, summarizeRatings } from "@/lib/data/reviews";
import { ProductMedia } from "@/components/shop/product-media";
import { ProductSpecs } from "@/components/shop/product-specs";
import { ProductInfoTabs } from "@/components/shop/product-info-tabs";
import { ProductReviews } from "@/components/shop/product-reviews";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { ProductRail } from "@/components/shop/product-rail";

export const revalidate = 300;

export async function generateStaticParams() {
  const slugs = await getAllActiveProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};

  const image = [...product.product_images].sort(
    (a, b) => a.position - b.position,
  )[0];

  return {
    title: product.name,
    description:
      product.description ?? `${product.name} — King Store.`,
    openGraph: {
      title: product.name,
      description: product.description ?? undefined,
      images: image ? [{ url: image.url }] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [relatedPool, settings, reviews] = await Promise.all([
    getRelatedProducts(product.category_id, product.id, 8),
    getSiteSettings(),
    getProductReviews(product.id),
  ]);
  const related = relatedPool.slice(0, 4);
  const alsoViewed = relatedPool.slice(4, 8);
  const ratingSummary = summarizeRatings(reviews);

  const images = [...product.product_images].sort(
    (a, b) => a.position - b.position,
  );
  // Falls back to the first variant's own color photo when the product has
  // no general gallery images at all (e.g. every photo was uploaded as a
  // per-color photo instead) — otherwise the cart thumbnail, OG image and
  // JSON-LD would all silently come up blank.
  const mainImage = images[0]?.url ?? product.product_variants[0]?.image_url ?? null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    image: images.map((i) => i.url),
    sku: product.id,
    brand: product.brand ? { "@type": "Brand", name: product.brand.name } : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      price: product.price,
      availability: product.product_variants.some((v) => v.stock > 0)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/produto/${product.slug}`,
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: process.env.NEXT_PUBLIC_SITE_URL || "/" },
      product.category && {
        "@type": "ListItem",
        position: 2,
        name: product.category.name,
        item: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/colecao?categoria=${product.category.slug}`,
      },
      {
        "@type": "ListItem",
        position: product.category ? 3 : 2,
        name: product.name,
      },
    ].filter(Boolean),
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-6 pb-16 md:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="mb-6">
        <Breadcrumbs
          items={[
            { label: "Início", href: "/" },
            { label: "Coleção", href: "/colecao" },
            ...(product.category
              ? [
                  {
                    label: product.category.name,
                    href: `/colecao?categoria=${product.category.slug}`,
                  },
                ]
              : []),
            { label: product.name },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[220px_minmax(0,1fr)_360px] lg:items-start lg:gap-8">
        <div className="order-3 lg:order-1">
          <ProductSpecs product={product} />
        </div>

        <ProductMedia product={product} images={images} mainImage={mainImage} />
      </div>

      <div className="mt-16 flex flex-col gap-16">
        <ProductInfoTabs
          description={product.description}
          shippingNote={product.shipping_note ?? settings.shipping_note}
          exchangeInfo={product.exchange_info}
          freeShippingNote={settings.free_shipping_note}
        />

        <ProductReviews
          productId={product.id}
          slug={product.slug}
          reviews={reviews}
          average={ratingSummary.average}
          count={ratingSummary.count}
        />
      </div>

      <div className="mt-4">
        <ProductRail title="Você também vai gostar" products={related} />
        <ProductRail title="Quem viu, também viu" products={alsoViewed} />
      </div>
    </div>
  );
}
