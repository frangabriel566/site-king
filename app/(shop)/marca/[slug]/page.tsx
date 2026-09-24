import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SafeImage } from "@/components/shop/safe-image";
import { getBrandBySlug } from "@/lib/data/brands";
import { getProductsByBrand } from "@/lib/data/products";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { ProductGrid } from "@/components/shop/product-grid";
import { EmptyState } from "@/components/shop/empty-state";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);
  if (!brand) return {};

  return {
    title: brand.name,
    description: brand.description ?? `Produtos ${brand.name} na King Store.`,
  };
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);
  if (!brand) notFound();

  const products = await getProductsByBrand(brand.id);

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-6 pb-16 md:px-8">
      <Breadcrumbs
        items={[
          { label: "Início", href: "/" },
          { label: "Marcas" },
          { label: brand.name },
        ]}
      />

      <div className="my-6 flex items-center gap-4">
        {brand.logo_url && (
          <SafeImage
            src={brand.logo_url}
            alt={brand.name}
            width={64}
            height={64}
            className="size-16 rounded-lg border border-line object-contain p-2"
            fallbackLabel={brand.name}
          />
        )}
        <div>
          <h1 className="text-2xl font-bold text-fg md:text-3xl">{brand.name}</h1>
          {brand.description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{brand.description}</p>
          )}
        </div>
      </div>

      {products.length === 0 ? (
        <EmptyState
          title="Nenhum produto encontrado"
          description="Ainda não há produtos ativos dessa marca."
          actionLabel="Ver coleção completa"
          actionHref="/colecao"
        />
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}
