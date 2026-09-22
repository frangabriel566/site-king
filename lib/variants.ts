import {
  SIMPLE_VARIANT_COLOR,
  SIMPLE_VARIANT_SIZE,
  isColorlessVariant,
  isSimpleVariant,
} from "@/lib/constants";
import { slugify } from "@/lib/format";

/**
 * How a product is sold, which is the only thing that decides what the
 * shopper gets to pick:
 *
 * - `colors` — cores e tamanhos: a card per colourway, sizes inside it.
 * - `sizes`  — one colourway, real sizes: the shopper picks P/M/G/GG/XG
 *              and each size carries its own stock. Stored as one row per
 *              size under the sentinel colour, so no swatch is shown.
 * - `single` — peça única: one row, one stock, nothing to pick.
 */
export type VariantMode = "colors" | "sizes" | "single";

/**
 * What actually gets persisted: one row per cor × tamanho
 * (product_variants). The form no longer edits these rows directly — it
 * edits `ColorDraft`s (below) and derives this list, but the shape sent
 * to the server is unchanged.
 */
export type VariantDraft = {
  clientId: string;
  color: string;
  color_hex: string;
  size: string;
  sku: string;
  /** true once the operator typed a SKU by hand — the generator then
   * leaves that row alone. */
  skuManual: boolean;
  stock: number;
  image_url: string;
};

/**
 * One color card in the form. A color exists on screen before any size is
 * picked (and therefore before it produces a single variant row), which
 * is why the editor can't key off the variant list itself: an unnamed,
 * sizeless card has nothing to key on.
 */
export type ColorDraft = {
  /** Client-only identity. Two cards can share a name (or have none yet)
   * and still stay separate cards. */
  id: string;
  name: string;
  hex: string;
  imageUrl: string;
  sizes: SizeDraft[];
};

export type SizeDraft = {
  size: string;
  stock: number;
  /** Empty unless the operator typed one — otherwise it's generated at
   * derive time from the current slug/color/size. */
  sku: string;
  skuManual: boolean;
};

export const LETTER_SIZES = ["P", "M", "G", "GG", "XG"];
export const NUMERIC_SIZES = ["34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44"];

export const DEFAULT_COLOR_HEX = "#0A0A0A";

/**
 * Only ever called from an event handler — the operator clicking "adicionar
 * outra cor" — never while rendering. An id minted during render differs
 * between the server pass and hydration, and everything downstream of it
 * (a DOM id, a generated SKU) mismatches with it. Cards that already exist
 * on the first render get their ids from the two helpers below instead.
 */
export function newClientId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function makeEmptyColor(): ColorDraft {
  return { id: newClientId(), name: "", hex: DEFAULT_COLOR_HEX, imageUrl: "", sizes: [] };
}

/** There is only ever one colourless card, and it lives in its own state
 * slot rather than in `colors`, so nothing can collide with a fixed id —
 * and a fixed id is what keeps its first render identical on both sides of
 * hydration. */
export const COLORLESS_COLOR_ID = "colorless";

/** The single, invisible "colour" behind `sizes` mode — the operator never
 * sees or names it; it exists so one colourway's sizes reuse exactly the
 * same draft shape (and the same variant rows) as every other product. */
export function makeColorlessColor(sizes: SizeDraft[] = []): ColorDraft {
  return {
    id: COLORLESS_COLOR_ID,
    name: SIMPLE_VARIANT_COLOR,
    hex: "",
    imageUrl: "",
    sizes,
  };
}

function buildSkuBase(productSlug: string, color: string, size: string): string {
  const parts = [productSlug, color, size].filter((p) => p && p.trim());
  if (parts.length === 0) return "";
  return slugify(parts.join(" ")).toUpperCase();
}

function withUniqueSuffix(base: string, seed: string, taken: Set<string>): string {
  if (!base || !taken.has(base)) return base;
  const suffix = seed.replace(/-/g, "").slice(-4).toUpperCase();
  return `${base}-${suffix}`;
}

/** SLUG-COR-TAMANHO, dodging SKUs already taken by other rows/products. */
export function autoSku(
  productSlug: string,
  color: string,
  size: string,
  seed: string,
  taken: Set<string>,
): string {
  return withUniqueSuffix(buildSkuBase(productSlug, color, size), seed, taken);
}

export function isSimpleVariantSet(variants: VariantDraft[]): boolean {
  return variants.length === 1 && isSimpleVariant(variants[0].color, variants[0].size);
}

/**
 * The single "variant" behind a produto sem variações: sentinel color and
 * size (see lib/constants), one stock, one SKU. Kept identical to what the
 * old editor wrote so existing rows round-trip unchanged.
 */
export function buildSimpleVariant(
  productSlug: string,
  sku: string,
  stock: number,
  existingSkus: string[],
): VariantDraft {
  const taken = new Set(existingSkus);
  const effectiveSku = sku.trim() || autoSku(productSlug, "", "", "simple", taken);
  return {
    clientId: "simple",
    color: SIMPLE_VARIANT_COLOR,
    color_hex: "",
    size: SIMPLE_VARIANT_SIZE,
    sku: effectiveSku,
    skuManual: sku.trim() !== "",
    stock,
    image_url: "",
  };
}

/**
 * Flattens the color cards into the rows the backend expects. SKUs for
 * rows the operator never touched are (re)generated here rather than at
 * creation time, so naming the product *after* picking colors still ends
 * up with SLUG-COR-TAMANHO instead of a SKU built from an empty slug.
 */
export function deriveVariants(
  colors: ColorDraft[],
  productSlug: string,
  existingSkus: string[] = [],
): VariantDraft[] {
  const taken = new Set(existingSkus);
  const rows: VariantDraft[] = [];

  // Manual SKUs are claimed up front: a generated one must dodge them all,
  // not just the ones that happen to come earlier in the list.
  for (const color of colors) {
    for (const size of color.sizes) {
      if (size.skuManual && size.sku.trim()) taken.add(size.sku.trim());
    }
  }

  for (const color of colors) {
    for (const size of color.sizes) {
      const clientId = `${color.id}:${size.size}`;
      let sku = size.sku.trim();
      if (!size.skuManual || !sku) {
        // The sentinel colour is internal bookkeeping — keeping it out of
        // the generated code leaves CAMISA-M rather than CAMISA-PADRAO-M.
        const skuColor = isColorlessVariant(color.name) ? "" : color.name;
        sku = autoSku(productSlug, skuColor, size.size, clientId, taken);
        taken.add(sku);
      }
      rows.push({
        clientId,
        color: color.name.trim(),
        color_hex: color.hex,
        size: size.size,
        sku,
        skuManual: size.skuManual,
        stock: size.stock,
        image_url: color.imageUrl,
      });
    }
  }

  return rows;
}

/** Existing product -> color cards, preserving saved SKUs as-is. This runs
 * while the form renders — on the server and then again on hydration — so
 * the ids are positional rather than random: both passes have to agree on
 * them. Colors are grouped by name, so the position is stable. */
export function colorsFromVariants(
  variants: { color: string; color_hex: string | null; size: string; sku: string | null; stock: number; image_url: string | null }[],
): ColorDraft[] {
  const byColor = new Map<string, ColorDraft>();

  for (const variant of variants) {
    let group = byColor.get(variant.color);
    if (!group) {
      group = {
        id: `saved-${byColor.size}`,
        name: variant.color,
        hex: variant.color_hex || DEFAULT_COLOR_HEX,
        imageUrl: variant.image_url ?? "",
        sizes: [],
      };
      byColor.set(variant.color, group);
    }
    group.sizes.push({
      size: variant.size,
      stock: variant.stock,
      sku: variant.sku ?? "",
      // A SKU that's already saved stays exactly as it is until the
      // operator edits it — renaming the color must not silently rewrite
      // a code that's already printed on a tag somewhere.
      skuManual: true,
    });
  }

  return Array.from(byColor.values());
}

/** Which mode an already-saved product was built in, so opening it for
 * editing lands on the same editor the operator used to create it. */
export function detectVariantMode(
  variants: { color: string; size: string }[],
): VariantMode {
  if (variants.length === 0) return "colors";
  if (variants.length === 1 && isSimpleVariant(variants[0].color, variants[0].size)) {
    return "single";
  }
  if (variants.every((variant) => isColorlessVariant(variant.color))) return "sizes";
  return "colors";
}

export type VariantTotals = { colors: number; sizes: number; variants: number };

export function countVariants(colors: ColorDraft[]): VariantTotals {
  const sizes = new Set<string>();
  let variants = 0;
  for (const color of colors) {
    for (const size of color.sizes) {
      sizes.add(size.size);
      variants += 1;
    }
  }
  return { colors: colors.length, sizes: sizes.size, variants };
}
