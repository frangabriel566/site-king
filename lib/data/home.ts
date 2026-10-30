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
  row: HomeSettingsRow | null;
  featured_product: FeaturedBannerProduct | null;
};

const EMPTY: HomeSettings = { row: null, featured_product: null };

async function loadHomeSettings(): Promise<HomeSettings> {
  const row = await getDb().query.home_settings.findFirst({
    where: eq(schema.home_settings.id, 1),
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
  });
  if (!row) return EMPTY;
  const { featured_product, ...rest } = row;
  // A product moved to the trash keeps its id; the card skips it.
  const product = featured_product && !featured_product.deleted_at ? featured_product : null;
  return {
    row: rest,
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
export const getHomeSettings = cache(
  (): Promise<HomeSettings> => safeQuery(loadHomeSettings, EMPTY),
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
