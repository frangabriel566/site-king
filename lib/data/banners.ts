import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Tables } from "@/lib/database.types";
import { requireAdminPage } from "@/lib/auth/guards";
import { ensureBannerColumns } from "@/lib/db/ensure-banner-columns";
import {
  parseBannerStyle,
  parseExtraSlides,
  type BannerKind,
  type HeroBannerData,
} from "@/lib/banner-style";
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
  return safeQuery(async () => {
    await ensureBannerColumns();
    return getDb().query.banners.findMany({
      where: eq(banners.active, true),
      orderBy: asc(banners.position),
      with: WITH_FEATURED,
    });
  }, []);
}

/** A row as the banner component wants it. Empty texts stay empty: in a
 * banner the panel controls, an empty field hides that line. */
export function toHeroBanner(row: Tables<"banners">): HeroBannerData {
  const first = {
    eyebrow: row.eyebrow ?? "",
    eyebrowHighlight: row.eyebrow_highlight ?? "",
    headline: row.headline_line1 ?? "",
    highlight: row.headline_line2 ?? "",
    subtitle: row.subtitle ?? "",
    ctaLabel: row.cta_label ?? "",
    ctaHref: row.cta_href || "/colecao",
  };
  return {
    id: row.id,
    kind: (row.kind === "pronto" ? "pronto" : "editavel") satisfies BannerKind,
    eyebrow: row.eyebrow ?? "",
    eyebrowHighlight: row.eyebrow_highlight ?? "",
    headline: row.headline_line1 ?? "",
    highlight: row.headline_line2 ?? "",
    subtitle: row.subtitle ?? "",
    ctaLabel: row.cta_label ?? "",
    ctaHref: row.cta_href || "/colecao",
    showWhatsapp: row.show_whatsapp,
    whatsappLabel: row.whatsapp_label ?? "",
    badge: row.badge ?? "",
    imageUrl: row.image_url,
    mobileImageUrl: row.mobile_image_url,
    extraSlides: row.kind === "pronto" ? [] : parseExtraSlides(row.extra_images, first),
    style: parseBannerStyle(row.style),
  };
}

/** Admin listing — all rows regardless of `active`. */
export async function getAllBannersAdmin(): Promise<Banner[]> {
  await requireAdminPage();
  await ensureBannerColumns();
  return getDb().query.banners.findMany({
    orderBy: asc(banners.position),
    with: WITH_FEATURED,
  });
}

export async function getBannerByIdAdmin(id: string): Promise<Banner | null> {
  await requireAdminPage();
  await ensureBannerColumns();
  const row = await getDb().query.banners.findFirst({
    where: eq(banners.id, id),
    with: WITH_FEATURED,
  });
  return row ?? null;
}
