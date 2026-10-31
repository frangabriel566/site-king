import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Tables } from "@/lib/database.types";
import { requireAdminPage } from "@/lib/auth/guards";
import type { FeaturedBannerProduct } from "./banners";
import { safeQuery } from "./safe";

export type HomeSettingsRow = Tables<"home_settings">;

/**
 * The texts the home's hero shows when the panel leaves a field empty —
 * the approved King Store copy (out/2026). Painel → Página inicial
 * overrides each one.
 */
export const HOME_DEFAULTS = {
  eyebrow: "VISTA-SE COMO UM",
  eyebrow_highlight: "REI",
  headline: "Grifes importadas a partir de",
  subtitle:
    "Peruanas, polos, sarjas e bermudas das marcas que você usa. Parcele em 3x sem juros ou feche direto pelo WhatsApp.",
  cta_label: "COMPRAR AGORA",
  cta_href: "/colecao",
  whatsapp_label: "Comprar pelo WhatsApp",
} as const;

export type HomeSettings = {
  /** The texts. The two photo columns are read apart (`images`). */
  row: HomeSettingsRow | null;
  featured_product: FeaturedBannerProduct | null;
  /** Photos fixed in the panel; null means "automatic". */
  images: HomeImages;
  /** Title of the KITS block from the panel; null is the kit's name. */
  kit_title: string | null;
};

export type HomeImages = {
  hero_image_url: string | null;
  kit_image_url: string | null;
};

const NO_IMAGES: HomeImages = { hero_image_url: null, kit_image_url: null };
const EMPTY: HomeSettings = {
  row: null,
  featured_product: null,
  images: NO_IMAGES,
  kit_title: null,
};

/** Migration 0016, read apart for the same reason as the photos. */
async function loadKitTitle(): Promise<string | null> {
  const row = await getDb()
    .select({ kit_title: schema.home_settings.kit_title })
    .from(schema.home_settings)
    .where(eq(schema.home_settings.id, 1))
    .get();
  return row?.kit_title?.trim() || null;
}

/**
 * The photo columns come from migration 0015. Read on their own, so a
 * database still without them only loses the fixed photos (the site goes
 * back to the banner's and the kit's), never the panel's texts.
 */
async function loadHomeImages(): Promise<HomeImages> {
  const row = await getDb()
    .select({
      hero_image_url: schema.home_settings.hero_image_url,
      kit_image_url: schema.home_settings.kit_image_url,
    })
    .from(schema.home_settings)
    .where(eq(schema.home_settings.id, 1))
    .get();
  return {
    hero_image_url: row?.hero_image_url || null,
    kit_image_url: row?.kit_image_url || null,
  };
}

async function loadHomeSettings(): Promise<HomeSettings> {
  const [row, images, kit_title] = await Promise.all([
    getDb().query.home_settings.findFirst({
      where: eq(schema.home_settings.id, 1),
      // Read apart, in loadHomeImages (migration 0015).
      columns: { hero_image_url: false, kit_image_url: false, kit_title: false },
      with: {
        featured_product: {
          columns: {
            id: true,
            slug: true,
            name: true,
            description: true,
            price: true,
            compare_at_price: true,
            deleted_at: true,
          },
        },
      },
    }),
    safeQuery(loadHomeImages, NO_IMAGES),
    safeQuery(loadKitTitle, null),
  ]);
  if (!row) return { ...EMPTY, images, kit_title };
  const { featured_product, ...rest } = row;
  // A product moved to the trash keeps its id; the card skips it.
  const product = featured_product && !featured_product.deleted_at ? featured_product : null;
  return {
    row: { ...rest, hero_image_url: null, kit_image_url: null, kit_title: null },
    images,
    kit_title,
    featured_product: product
      ? {
          id: product.id,
          slug: product.slug,
          name: product.name,
          description: product.description,
          price: product.price,
          compare_at_price: product.compare_at_price,
        }
      : null,
  };
}

/** Public. Falls back to the default texts on any error — including before
 * the home_settings table exists in the database. */
export const getHomeSettings = cache((): Promise<HomeSettings> =>
  safeQuery(loadHomeSettings, EMPTY),
);

/** Admin form. Same read, but behind the admin guard. */
export async function getHomeSettingsAdmin(): Promise<HomeSettings> {
  await requireAdminPage();
  return safeQuery(loadHomeSettings, EMPTY);
}

/** Field value or its default; an empty field means "use the default". */
export function homeText(row: HomeSettingsRow | null, key: keyof typeof HOME_DEFAULTS): string {
  const value = row?.[key]?.trim();
  return value ? value : HOME_DEFAULTS[key];
}
