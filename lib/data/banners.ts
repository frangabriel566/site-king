import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Tables } from "@/lib/database.types";
import { requireAdminPage } from "@/lib/auth/guards";
import { safeQuery } from "./safe";

export type FeaturedBannerProduct = Pick<
  Tables<"products">,
  "id" | "slug" | "name" | "description" | "price" | "compare_at_price"
>;

export type Banner = Tables<"banners"> & {
  featured_product: FeaturedBannerProduct | null;
};

const { banners } = schema;

const WITH_FEATURED = {
  featured_product: {
    columns: {
      id: true,
      slug: true,
      name: true,
      description: true,
      price: true,
      compare_at_price: true,
    },
  },
} as const;

/** Public: active banners only. */
export async function getActiveBanners(): Promise<Banner[]> {
  return safeQuery(
    () =>
      getDb().query.banners.findMany({
        where: eq(banners.active, true),
        orderBy: asc(banners.position),
        with: WITH_FEATURED,
      }),
    [],
  );
}

/** Admin listing — all rows regardless of `active`. */
export async function getAllBannersAdmin(): Promise<Banner[]> {
  await requireAdminPage();
  return getDb().query.banners.findMany({
    orderBy: asc(banners.position),
    with: WITH_FEATURED,
  });
}

export async function getBannerByIdAdmin(id: string): Promise<Banner | null> {
  await requireAdminPage();
  const row = await getDb().query.banners.findFirst({
    where: eq(banners.id, id),
    with: WITH_FEATURED,
  });
  return row ?? null;
}
