import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Tables } from "@/lib/database.types";
import { safeQuery } from "./safe";

export type SiteSettings = Tables<"site_settings">;

const FALLBACK_SETTINGS: SiteSettings = {
  id: 1,
  store_name: "King Store",
  logo_url: null,
  whatsapp: null,
  email: null,
  instagram: null,
  tiktok: null,
  youtube: null,
  shipping_note: null,
  free_shipping_note: null,
  announcement: null,
  announcement_active: false,
  origin_document: null,
  origin_cep: null,
  origin_street: null,
  origin_number: null,
  origin_complement: null,
  origin_district: null,
  origin_city: null,
  origin_state: null,
};

/** Public. Read once per request — the layout, the page and the WhatsApp
 * helpers all ask for it. */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  return safeQuery(async () => {
    const row = await getDb().query.site_settings.findFirst({
      where: eq(schema.site_settings.id, 1),
    });
    return row ?? FALLBACK_SETTINGS;
  }, FALLBACK_SETTINGS);
});
