import { z } from "zod";

/**
 * The home's top banners (Painel → Banners), shared by the storefront and
 * the panel's live preview. Two kinds:
 *
 * - "editavel": the approved King Store art (nov/2026) — background photo,
 *   texts, fonts and colours all set in the panel;
 * - "pronto": a finished image made elsewhere (Canva…), one for the phone
 *   and one for the computer, shown whole and linking somewhere.
 *
 * The look of an "editavel" banner lives in one JSON column
 * (`banners.style`), parsed here with defaults so a missing or partly
 * filled value always renders the approved art.
 */

export const BANNER_KINDS = ["editavel", "pronto"] as const;
export type BannerKind = (typeof BANNER_KINDS)[number];

type FontDef = {
  label: string;
  /** CSS font-family value. */
  family: string;
  /** Google Fonts css2 `family=` value; null = bundled with the site. */
  google: string | null;
  /** Heaviest weight the font has, for headlines. */
  heavy: number;
};

export const BANNER_FONTS = {
  saira: { label: "Saira (títulos do site)", family: "var(--font-saira), sans-serif", google: null, heavy: 900 },
  michroma: { label: "Michroma (larga, do site)", family: "var(--font-michroma), sans-serif", google: null, heavy: 400 },
  archivo: { label: "Archivo (texto do site)", family: "var(--font-archivo), sans-serif", google: null, heavy: 900 },
  bebas: { label: "Bebas Neue", family: "'Bebas Neue', sans-serif", google: "Bebas+Neue", heavy: 400 },
  anton: { label: "Anton", family: "'Anton', sans-serif", google: "Anton", heavy: 400 },
  oswald: { label: "Oswald", family: "'Oswald', sans-serif", google: "Oswald:wght@400;600;700", heavy: 700 },
  teko: { label: "Teko", family: "'Teko', sans-serif", google: "Teko:wght@400;600;700", heavy: 700 },
  russo: { label: "Russo One", family: "'Russo One', sans-serif", google: "Russo+One", heavy: 400 },
  montserrat: { label: "Montserrat", family: "'Montserrat', sans-serif", google: "Montserrat:wght@400;600;800;900", heavy: 900 },
  poppins: { label: "Poppins", family: "'Poppins', sans-serif", google: "Poppins:wght@400;600;800;900", heavy: 900 },
  inter: { label: "Inter", family: "'Inter', sans-serif", google: "Inter:wght@400;600;800;900", heavy: 900 },
  playfair: { label: "Playfair Display (elegante)", family: "'Playfair Display', serif", google: "Playfair+Display:wght@400;700;900", heavy: 900 },
  cinzel: { label: "Cinzel (realeza)", family: "'Cinzel', serif", google: "Cinzel:wght@400;700;900", heavy: 900 },
  bodoni: { label: "Bodoni Moda (moda)", family: "'Bodoni Moda', serif", google: "Bodoni+Moda:wght@400;700;900", heavy: 900 },
} satisfies Record<string, FontDef>;

export type BannerFontKey = keyof typeof BANNER_FONTS;
const FONT_KEYS = Object.keys(BANNER_FONTS) as [BannerFontKey, ...BannerFontKey[]];

export const HEADLINE_SIZES = {
  p: { label: "Pequeno", mobile: 34, desktop: 60 },
  m: { label: "Médio", mobile: 40, desktop: 72 },
  g: { label: "Grande", mobile: 46, desktop: 84 },
  gg: { label: "Gigante", mobile: 54, desktop: 100 },
} as const;
export type HeadlineSize = keyof typeof HEADLINE_SIZES;

const color = (fallback: string) =>
  z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .catch(fallback);

/** Defaults = the approved art. Every field falls back on its own. */
export const bannerStyleSchema = z.object({
  headlineFont: z.enum(FONT_KEYS).catch("saira"),
  eyebrowFont: z.enum(FONT_KEYS).catch("michroma"),
  bodyFont: z.enum(FONT_KEYS).catch("archivo"),
  buttonFont: z.enum(FONT_KEYS).catch("saira"),
  headlineSize: z.enum(["p", "m", "g", "gg"]).catch("g"),
  uppercase: z.boolean().catch(true),
  bgColor: color("#0B0B0C"),
  textColor: color("#F4EFE6"),
  highlightColor: color("#E8D39A"),
  eyebrowColor: color("#C9AA6E"),
  subtitleColor: color("#C9C3B8"),
  buttonColor: color("#C9AA6E"),
  buttonTextColor: color("#111214"),
  /** 0–80: how much the photo is darkened. */
  overlay: z.number().int().min(0).max(80).catch(0),
  /** Vertical focus of the photo, 0 (top) – 100 (bottom). */
  focusMobile: z.number().int().min(0).max(100).catch(18),
  focusDesktop: z.number().int().min(0).max(100).catch(30),
  /** Computer: photo on the right ("split") or across the whole banner. */
  desktopLayout: z.enum(["split", "full"]).catch("split"),
});

export type BannerStyle = z.infer<typeof bannerStyleSchema>;

export const DEFAULT_BANNER_STYLE: BannerStyle = bannerStyleSchema.parse({});

export function parseBannerStyle(raw: string | null | undefined): BannerStyle {
  if (!raw) return DEFAULT_BANNER_STYLE;
  try {
    const value: unknown = JSON.parse(raw);
    return bannerStyleSchema.parse(value && typeof value === "object" ? value : {});
  } catch {
    return DEFAULT_BANNER_STYLE;
  }
}

/** Everything the banner component needs, from a row or from the form. */
export type HeroBannerData = {
  id: string;
  kind: BannerKind;
  eyebrow: string;
  eyebrowHighlight: string;
  headline: string;
  highlight: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  showWhatsapp: boolean;
  whatsappLabel: string;
  badge: string;
  /** Background photo ("editavel") or the computer image ("pronto"). */
  imageUrl: string | null;
  /** Phone image; null uses imageUrl. */
  mobileImageUrl: string | null;
  /** More background photos ("editavel"): they take turns with the first
   * one behind the same texts. */
  extraImages: string[];
  style: BannerStyle;
};

/** Most photos one banner takes turns with, the first one included. */
export const MAX_BANNER_PHOTOS = 8;

/** banners.extra_images (JSON array of URLs) → the URLs. */
export function parseExtraImages(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((url): url is string => typeof url === "string" && url.length > 0)
      : [];
  } catch {
    return [];
  }
}

/** The approved art's copy, used for a new banner. */
export const DEFAULT_BANNER_TEXTS = {
  eyebrow: "VISTA-SE COMO UM",
  eyebrowHighlight: "REI",
  headline: "Peças importadas a partir de",
  highlight: "R$ 64,90",
  subtitle:
    "Peruanas, polos, sarjas e bermudas das marcas que você usa. Parcele em 3x sem juros ou feche direto pelo WhatsApp.",
  ctaLabel: "COMPRAR AGORA",
  ctaHref: "/colecao",
  whatsappLabel: "Comprar pelo WhatsApp",
  badge: "Frete grátis acima de R$ 399",
} as const;

/** Google Fonts stylesheet for the fonts these banners use, or null. */
export function googleFontsHref(styles: BannerStyle[]): string | null {
  const families = new Set<string>();
  for (const style of styles) {
    for (const key of [style.headlineFont, style.eyebrowFont, style.bodyFont, style.buttonFont]) {
      const google = BANNER_FONTS[key].google;
      if (google) families.add(google);
    }
  }
  if (families.size === 0) return null;
  const query = [...families].sort().map((family) => `family=${family}`).join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}
