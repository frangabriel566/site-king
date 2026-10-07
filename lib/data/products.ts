import "server-only";
import { cache } from "react";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  lte,
  max,
  min,
  ne,
  type SQL,
} from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Tables, ProductBadge } from "@/lib/database.types";
import { requireAdminPage } from "@/lib/auth/guards";
import {
  COLLECTION_PAGE_SIZE,
  SIZE_ORDER,
  isColorlessVariant,
  isSimpleVariant,
} from "@/lib/constants";
import { buildGallerySlides, getProductColors } from "@/lib/product-gallery";
import { normalizeSearchText } from "@/lib/search-text";
import { safeQuery } from "./safe";

export type ProductImage = Tables<"product_images">;
export type ProductVariant = Tables<"product_variants">;
export type Category = Tables<"categories">;
export type Brand = Tables<"brands">;

type ProductBrandRef = Pick<Brand, "id" | "name" | "slug" | "logo_url">;

export type ProductWithRelations = Tables<"products"> & {
  product_images: ProductImage[];
  product_variants: ProductVariant[];
  category: Pick<Category, "id" | "name" | "slug"> | null;
  brand: ProductBrandRef | null;
};

type ListImage = Pick<ProductImage, "id" | "url" | "alt" | "position">;
type ListVariant = Pick<
  ProductVariant,
  "id" | "color" | "color_hex" | "size" | "stock" | "image_url"
>;
type ListBrand = Pick<Brand, "id" | "name" | "slug">;

export type ProductListItem = {
  id: string;
  slug: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  image: ListImage | null;
  secondImage: ListImage | null;
  /** The photo the product page's gallery opens on, which is not always
   * `image`: with color photos the gallery leads with the first color. The
   * card preloads it on hover/touch. */
  heroImage: string | null;
  colors: { color: string; color_hex: string | null }[];
  inStock: boolean;
  totalStock: number;
  badge: ProductBadge | null;
  brand: ListBrand | null;
  /** ISO timestamp — the "Novo" badge compares it with the store's rule. */
  createdAt: string;
};

const { products, product_variants, categories, brands } = schema;

/** What a product card needs — the old PostgREST LIST_SELECT. */
const LIST_COLUMNS = {
  id: true,
  slug: true,
  name: true,
  price: true,
  compare_at_price: true,
  created_at: true,
  position: true,
  badge: true,
} as const;

const LIST_WITH = {
  brand: { columns: { id: true, name: true, slug: true } },
  product_images: { columns: { id: true, url: true, alt: true, position: true } },
  product_variants: {
    columns: {
      id: true,
      color: true,
      color_hex: true,
      size: true,
      stock: true,
      image_url: true,
    },
  },
} as const;

const DETAIL_WITH = {
  product_images: true,
  product_variants: true,
  category: { columns: { id: true, name: true, slug: true } },
  brand: { columns: { id: true, name: true, slug: true, logo_url: true } },
} as const;

const isActive = eq(products.status, "active");

function toListItem(row: {
  id: string;
  slug: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  created_at: string;
  badge?: ProductBadge | null;
  brand?: ListBrand | null;
  product_images: ListImage[];
  product_variants: ListVariant[];
}): ProductListItem {
  const sortedImages = [...row.product_images].sort(
    (a, b) => a.position - b.position,
  );
  // A product with no general gallery images at all (every photo uploaded
  // as a per-color photo instead) would otherwise show as "sem imagem" on
  // every card and rail — fall back to the first variant that has one.
  const fallbackImage = !sortedImages[0]
    ? (() => {
        const url = row.product_variants.find((v) => v.image_url)?.image_url;
        return url ? { id: `variant-photo-${url}`, url, alt: null, position: 0 } : null;
      })()
    : null;
  const colorMap = new Map<string, string | null>();
  let inStock = false;
  let totalStock = 0;
  for (const variant of row.product_variants) {
    // Sentinel colours are bookkeeping, not a colourway the shopper can
    // pick — a card showing a "Padrão" swatch would be showing plumbing.
    if (!isColorlessVariant(variant.color) && !colorMap.has(variant.color)) {
      colorMap.set(variant.color, variant.color_hex);
    }
    if (variant.stock > 0) inStock = true;
    totalStock += variant.stock;
  }

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    price: row.price,
    compare_at_price: row.compare_at_price,
    image: sortedImages[0] ?? fallbackImage,
    secondImage: sortedImages[1] ?? null,
    // Same inputs the product page hands its gallery, down to the page's
    // own `mainImage` fallback.
    heroImage:
      buildGallerySlides(
        row.name,
        getProductColors(row.product_variants),
        sortedImages,
        sortedImages[0]?.url ?? row.product_variants[0]?.image_url ?? null,
      )[0]?.url ?? null,
    colors: Array.from(colorMap, ([color, color_hex]) => ({ color, color_hex })),
    inStock,
    totalStock,
    badge: row.badge ?? null,
    brand: row.brand ?? null,
    createdAt: row.created_at,
  };
}

/**
 * A home rail holds exactly the products the merchant placed there in
 * "Exibição" (products.badge) — nothing else.
 *
 * It used to top a short rail up with untagged products, using each
 * rail's old implicit signal (newest for Lançamentos, a promo price for
 * Ofertas, the destaque switch for Mais vendidos). That made every newly
 * registered product show up in rails nobody had put it in — a product
 * saved as "Produtos" still surfaced under Lançamentos, since untagged
 * plus no filter matched everything. The placement now decides, and a
 * rail nobody has filled renders nothing at all: ProductRail and
 * OffersBlock both return null when empty, so the home closes the gap.
 *
 * `featured` no longer decides *whether* a product is on a rail, only
 * that it leads the one it was placed in.
 */
async function fetchRail(
  badgeValue: ProductBadge,
  limit: number,
  orderColumn: "position" | "created_at",
): Promise<ProductListItem[]> {
  const rows = await getDb().query.products.findMany({
    columns: LIST_COLUMNS,
    with: LIST_WITH,
    where: and(isActive, eq(products.badge, badgeValue)),
    orderBy: [
      desc(products.featured),
      orderColumn === "position" ? asc(products.position) : desc(products.created_at),
      // Every product starts at position 0, so ordering by position alone
      // leaves the database free to hand back ties in any order on every
      // request — a new product landed inside or outside the rail at random.
      // Newest wins a tie, which also puts a just-registered product first.
      desc(products.created_at),
    ],
    limit,
  });
  return rows.map(toListItem);
}

export async function getFeaturedProducts(limit = 4): Promise<ProductListItem[]> {
  return safeQuery(() => fetchRail("mais_vendido", limit, "position"), []);
}

export async function getNewArrivals(limit = 8): Promise<ProductListItem[]> {
  return safeQuery(() => fetchRail("lancamento", limit, "created_at"), []);
}

/** "Ofertas" home rail — the products placed there, not every marked-down
 * product: a discount shows on the product's own card wherever it sits. */
export async function getOnSaleProducts(limit = 8): Promise<ProductListItem[]> {
  return safeQuery(() => fetchRail("oferta", limit, "position"), []);
}

export type ProductSort = "relevance" | "newest" | "price-asc" | "price-desc";

export type ProductListFilters = {
  /** Overrides the /colecao page size. The home rails use it to show the
   * whole shelf at once instead of a first page. */
  limit?: number;
  category?: string;
  brand?: string;
  sizes?: string[];
  colors?: string[];
  minPrice?: number;
  maxPrice?: number;
  onSale?: boolean;
  sort?: ProductSort;
  page?: number;
  /** Home page's "Produtos" rail only: hides products explicitly placed in
   * one of the other three rails, so a product picked for e.g. Lançamentos
   * doesn't also show up here. Leave unset for the full /colecao catalog,
   * which lists every active product regardless of badge. */
  excludeBadged?: boolean;
  /** Home rails only: products with the destaque switch on lead the list,
   * matching the three badge rails. The catalog leaves it off so the
   * shopper's own sort is the only thing ordering /colecao. */
  featuredFirst?: boolean;
};

export type ProductListResult = {
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function listOrder(filters: ProductListFilters): SQL[] {
  switch (filters.sort) {
    case "newest":
      return [desc(products.created_at)];
    case "price-asc":
      return [asc(products.price)];
    case "price-desc":
      return [desc(products.price)];
    default:
      return [
        ...(filters.featuredFirst ? [desc(products.featured)] : []),
        asc(products.position),
        // See fetchRail: position is 0 for nearly everything, so without
        // this the tie order is whatever the database felt like.
        desc(products.created_at),
      ];
  }
}

export async function listProducts(
  filters: ProductListFilters = {},
): Promise<ProductListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.limit ?? COLLECTION_PAGE_SIZE;
  const emptyResult: ProductListResult = {
    items: [],
    total: 0,
    page,
    pageSize,
    totalPages: 0,
  };

  return safeQuery(async () => {
    const db = getDb();
    const conditions: SQL[] = [isActive];

    if (filters.excludeBadged) conditions.push(isNull(products.badge));

    if (filters.category) {
      conditions.push(
        inArray(
          products.category_id,
          db.select({ id: categories.id }).from(categories).where(eq(categories.slug, filters.category)),
        ),
      );
    }

    if (filters.brand) {
      conditions.push(
        inArray(
          products.brand_id,
          db.select({ id: brands.id }).from(brands).where(eq(brands.slug, filters.brand)),
        ),
      );
    }

    if (filters.sizes?.length || filters.colors?.length) {
      const variantConditions: SQL[] = [];
      if (filters.sizes?.length) variantConditions.push(inArray(product_variants.size, filters.sizes));
      if (filters.colors?.length) variantConditions.push(inArray(product_variants.color, filters.colors));
      conditions.push(
        inArray(
          products.id,
          db
            .select({ id: product_variants.product_id })
            .from(product_variants)
            .where(and(...variantConditions)),
        ),
      );
    }

    if (filters.minPrice !== undefined) conditions.push(gte(products.price, filters.minPrice));
    if (filters.maxPrice !== undefined) conditions.push(lte(products.price, filters.maxPrice));
    if (filters.onSale) conditions.push(isNotNull(products.compare_at_price));

    const where = and(...conditions);
    // One round trip for the page and its total.
    const [rows, [{ total }]] = await db.batch([
      db.query.products.findMany({
        columns: LIST_COLUMNS,
        with: LIST_WITH,
        where,
        orderBy: listOrder(filters),
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
      db.select({ total: count() }).from(products).where(where),
    ]);

    return {
      items: rows.map(toListItem),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }, emptyResult);
}

/** Public: an active product with everything its page shows. Cached per
 * request — the page, generateMetadata and the OG image all ask. */
export const getProductBySlug = cache(
  async (slug: string): Promise<ProductWithRelations | null> => {
    return safeQuery(async () => {
      const row = await getDb().query.products.findFirst({
        where: and(eq(products.slug, slug), isActive),
        with: DETAIL_WITH,
      });
      return row ?? null;
    }, null);
  },
);

export async function getRelatedProducts(
  categoryId: string | null,
  excludeProductId: string,
  limit = 4,
): Promise<ProductListItem[]> {
  if (!categoryId) return [];
  return safeQuery(async () => {
    const rows = await getDb().query.products.findMany({
      columns: LIST_COLUMNS,
      with: LIST_WITH,
      where: and(isActive, eq(products.category_id, categoryId), ne(products.id, excludeProductId)),
      limit,
    });
    return rows.map(toListItem);
  }, []);
}

export type AdminProductListItem = Tables<"products"> & {
  category: Pick<Category, "id" | "name"> | null;
  brand: Pick<Brand, "id" | "name"> | null;
  product_images: Pick<ProductImage, "url">[];
  product_variants: Pick<ProductVariant, "id" | "stock" | "image_url">[];
};

/** Admin listing — every status. */
export async function getAllProductsAdmin(): Promise<AdminProductListItem[]> {
  await requireAdminPage();
  return getDb().query.products.findMany({
    orderBy: asc(products.position),
    with: {
      category: { columns: { id: true, name: true } },
      brand: { columns: { id: true, name: true } },
      product_images: { columns: { url: true } },
      product_variants: { columns: { id: true, stock: true, image_url: true } },
    },
  });
}

/** Every slug already taken, so the form can settle on a free one while
 * the operator types instead of failing on the unique index at save. */
export async function getAllProductSlugs(excludeProductId?: string): Promise<string[]> {
  await requireAdminPage();
  const rows = await getDb()
    .select({ slug: products.slug })
    .from(products)
    .where(excludeProductId ? ne(products.id, excludeProductId) : undefined);
  return rows.map((product) => product.slug);
}

/**
 * Every SKU already in use, across every product except the one being
 * edited. `sku` is unique DB-wide (not per-product), but the admin form's
 * auto-generator only dedupes against the variants already on screen —
 * without this, two different products can independently land on the
 * same generated SKU and only find out when the save is rejected.
 */
export async function getAllVariantSkus(excludeProductId?: string): Promise<string[]> {
  await requireAdminPage();
  const rows = await getDb()
    .select({ sku: product_variants.sku })
    .from(product_variants)
    .where(
      and(
        isNotNull(product_variants.sku),
        excludeProductId ? ne(product_variants.product_id, excludeProductId) : undefined,
      ),
    );
  return rows.map((v) => v.sku).filter((sku): sku is string => sku !== null);
}

export type ProductOption = Pick<
  Tables<"products">,
  "id" | "name" | "slug" | "description" | "price"
>;

export async function getProductOptions(): Promise<ProductOption[]> {
  await requireAdminPage();
  return getDb()
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      description: products.description,
      price: products.price,
    })
    .from(products)
    .orderBy(asc(products.name));
}

export async function getProductByIdAdmin(
  id: string,
): Promise<ProductWithRelations | null> {
  await requireAdminPage();
  const row = await getDb().query.products.findFirst({
    where: eq(products.id, id),
    with: DETAIL_WITH,
  });
  return row ?? null;
}

/** Products for the /marca/[slug] storefront page. */
export async function getProductsByBrand(brandId: string): Promise<ProductListItem[]> {
  return safeQuery(async () => {
    const rows = await getDb().query.products.findMany({
      columns: LIST_COLUMNS,
      with: LIST_WITH,
      where: and(isActive, eq(products.brand_id, brandId)),
      orderBy: asc(products.position),
    });
    return rows.map(toListItem);
  }, []);
}

export async function getAllActiveProductSlugs(): Promise<string[]> {
  return safeQuery(async () => {
    const rows = await getDb().select({ slug: products.slug }).from(products).where(isActive);
    return rows.map((p) => p.slug);
  }, []);
}

/**
 * Header search. Matches `products.search_text` (name + brand + category,
 * lowercased and without accents) against the term normalized the same
 * way, so "calça", "CALÇA" and "calca" find the same product. Every word
 * has to appear somewhere: "calca zara" finds Zara's calças.
 */
export async function searchProducts(term: string, limit = 8): Promise<ProductListItem[]> {
  const words = normalizeSearchText(term)
    // LIKE wildcards in the term would match more than what was typed.
    .replace(/[%_\\]/g, " ")
    .split(" ")
    .filter(Boolean);
  if (words.join("").length < 2) return [];

  return safeQuery(async () => {
    const rows = await getDb().query.products.findMany({
      columns: LIST_COLUMNS,
      with: LIST_WITH,
      where: and(isActive, ...words.map((word) => like(products.search_text, `%${word}%`))),
      limit,
    });
    return rows.map(toListItem);
  }, []);
}

export type FilterOptions = {
  sizes: string[];
  colors: { color: string; color_hex: string | null }[];
};

export async function getFilterOptions(): Promise<FilterOptions> {
  const fallback: FilterOptions = { sizes: [], colors: [] };
  return safeQuery(async () => {
    const rows = await getDb()
      .select({
        size: product_variants.size,
        color: product_variants.color,
        color_hex: product_variants.color_hex,
      })
      .from(product_variants)
      .innerJoin(products, eq(products.id, product_variants.product_id))
      .where(isActive);

    const sizeSet = new Set<string>();
    const colorMap = new Map<string, string | null>();
    for (const row of rows) {
      if (isSimpleVariant(row.color, row.size)) continue;
      // A one-colourway product still contributes its sizes to the filter —
      // only its sentinel colour is left out of the colour list.
      sizeSet.add(row.size);
      if (isColorlessVariant(row.color) || colorMap.has(row.color)) continue;
      colorMap.set(row.color, row.color_hex);
    }

    return {
      sizes: Array.from(sizeSet).sort((a, b) => {
        const ai = SIZE_ORDER.indexOf(a as (typeof SIZE_ORDER)[number]);
        const bi = SIZE_ORDER.indexOf(b as (typeof SIZE_ORDER)[number]);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      }),
      colors: Array.from(colorMap, ([color, color_hex]) => ({ color, color_hex })),
    };
  }, fallback);
}

export async function getPriceRange(): Promise<{ min: number; max: number }> {
  const fallback = { min: 0, max: 1000 };
  return safeQuery(async () => {
    const [row] = await getDb()
      .select({ min: min(products.price), max: max(products.price) })
      .from(products)
      .where(isActive);
    if (!row || row.min === null || row.max === null) return fallback;
    return { min: row.min, max: row.max };
  }, fallback);
}
