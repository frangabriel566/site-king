import type { MetadataRoute } from "next";
import { getSiteSettings } from "@/lib/data/settings";
import { storeLogoIconUrls } from "@/lib/image-url";

// Read per request, like every page: the settings live in D1.
export const dynamic = "force-dynamic";

/**
 * "Adicionar à tela inicial" on Android: the store's name and, when there
 * is a logo, the 512px icon made from it (iOS reads the apple-touch-icon
 * from app/layout.tsx instead). It opens as the plain site in the browser —
 * nothing here turns the store into an installed app.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getSiteSettings();
  const icons = storeLogoIconUrls(settings.logo_url);
  return {
    name: settings.store_name,
    short_name: settings.store_name,
    start_url: "/",
    display: "browser",
    background_color: "#000000",
    theme_color: "#000000",
    icons: icons
      ? [{ src: icons.icon, sizes: "512x512", type: "image/png", purpose: "any" }]
      : [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
