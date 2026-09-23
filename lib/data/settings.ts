import { createPublicClient } from "@/lib/supabase/public";
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

export async function getSiteSettings(): Promise<SiteSettings> {
  return safeQuery(async () => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("site_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    return data ?? FALLBACK_SETTINGS;
  }, FALLBACK_SETTINGS);
}
