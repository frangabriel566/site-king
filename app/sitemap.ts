import type { MetadataRoute } from "next";
import { getAllActiveProductSlugs } from "@/lib/data/products";
import { getActiveCategories } from "@/lib/data/categories";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const [slugs, categories] = await Promise.all([
    getAllActiveProductSlugs(),
    getActiveCategories(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/colecao`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/sobre`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/trocas-e-devolucoes`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/politica-de-privacidade`, changeFrequency: "monthly", priority: 0.3 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${siteUrl}/colecao?categoria=${category.slug}`,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const productRoutes: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${siteUrl}/produto/${slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
