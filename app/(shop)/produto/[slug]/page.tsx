import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getAllActiveProductSlugs,
  getProductBySlug,
  getRelatedProducts,
} from "@/lib/data/products";
import { getSiteSettings } from "@/lib/data/settings";
import { formatCurrency } from "@/lib/format";
import { ProductGallery } from "@/components/shop/product-gallery";
import { VariantSelector } from "@/components/shop/variant-selector";
import { SizeGuideModal } from "@/components/shop/size-guide-modal";
import { ProductAccordion } from "@/components/shop/product-accordion";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { ProductGrid } from "@/components/shop/product-grid";

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

  const [related, settings] = await Promise.all([
    getRelatedProducts(product.category_id, product.id),
    getSiteSettings(),
  ]);

  const images = [...product.product_images].sort(
    (a, b) => a.position - b.position,
  );
  const mainImage = images[0]?.url ?? null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    image: images.map((i) => i.url),
    sku: product.id,
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      price: product.price,
      availability: product.product_variants.some((v) => v.stock > 0)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/produto/${product.slug}`,
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: process.env.NEXT_PUBLIC_SITE_URL ?? "/" },
      product.category && {
        "@type": "ListItem",
        position: 2,
        name: product.category.name,
        item: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/colecao?categoria=${product.category.slug}`,
      },
      {
        "@type": "ListItem",
        position: product.category ? 3 : 2,
        name: product.name,
      },
    ].filter(Boolean),
  };

  return (
    <div className="px-8 pt-8 pb-24 md:px-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="mb-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
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

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
        <ProductGallery images={images} productName={product.name} />

        <div className="lg:max-w-md">
          <h1 className="text-heading text-3xl sm:text-4xl">{product.name}</h1>
          <div className="mt-4 flex items-center gap-3">
            {product.compare_at_price && (
              <span className="text-sm text-ink-muted line-through">
                {formatCurrency(product.compare_at_price)}
              </span>
            )}
            <span className="text-xl">{formatCurrency(product.price)}</span>
          </div>

          <div className="mt-8">
            <VariantSelector
              productId={product.id}
              productSlug={product.slug}
              productName={product.name}
              price={product.price}
              image={mainImage}
              variants={product.product_variants}
            />
            <div className="mt-4">
              <SizeGuideModal />
            </div>
          </div>

          <div className="mt-10">
            <ProductAccordion
              description={product.description}
              shippingNote={settings.shipping_note}
              freeShippingNote={settings.free_shipping_note}
            />
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-24">
          <h2 className="text-heading mb-10 text-3xl">Você também vai gostar</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
