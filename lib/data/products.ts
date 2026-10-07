import "server-only";
import { cache } from "react";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  like,
  lte,
  max,
  min,
  ne,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Tables, ProductBadge } from "@/lib/database.types";
import { requireAdminPage } from "@/lib/auth/guards";
import {
  COLLECTION_PAGE_SIZE,
  CONFIRMED_ORDER_STATUSES,
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
  category: Pick<Category, "id" | "name" | "slug" | "size_guide"> | null;
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

const { products, product_variants, categories, brands, orders, order_items } = schema;

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
  // size_guide: the product page's "Guia de medidas" (Admin → Categorias).
  category: { columns: { id: true, name: true, slug: true, size_guide: true } },
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

/*
 * The home rails are worked out from the data, not placed by hand: what
 * is newest, what is marked down, what has sold. A product registered in
 * the panel is on "Novidades" the moment it is published, and an empty
 * rail renders nothing (ProductRail returns null), so the home closes the
 * gap. products.badge is only the card's label now.
 */

/** A real markdown: a "de" price above the selling price. A "de" price at
 * or under it is a data-entry slip, and the card shows no discount for it
 * either (discountPercent in lib/shop-config). A null "de" price compares
 * as null, which leaves the product out too. */
const isDiscounted = gt(products.compare_at_price, products.price);

/** At least one variant with stock. The home rails are a shop window: a
 * sold-out product leading "Novidades" is a dead end the shopper can only
 * back out of. It stays in the catalog (/colecao), marked Esgotado.
 *
 * The variant side is spelled out by hand on purpose: inside a
 * `db.query.*.findMany` where, drizzle rewrites every column object to the
 * root table's alias, so `${product_variants.product_id}` would come out as
 * "products"."product_id". Only the outer `products.id` may be a column. */
const hasStock = sql`exists (
  select 1 from "product_variants" "in_stock"
  where "in_stock"."product_id" = ${products.id} and "in_stock"."stock" > 0
)`;

/** "Novidades": the most recently registered active products in stock. */
export async function getNewestProducts(limit = 8): Promise<ProductListItem[]> {
  return safeQuery(async () => {
    const rows = await getDb().query.products.findMany({
      columns: LIST_COLUMNS,
      with: LIST_WITH,
      where: and(isActive, hasStock),
      orderBy: desc(products.created_at),
      limit,
    });
    return rows.map(toListItem);
  }, []);
}

/** "Ofertas": every active product with a real discount, biggest first. */
export async function getDiscountedProducts(limit = 8): Promise<ProductListItem[]> {
  return safeQuery(async () => {
    const rows = await getDb().query.products.findMany({
      columns: LIST_COLUMNS,
      with: LIST_WITH,
      where: and(isActive, hasStock, isDiscounted),
      orderBy: [
        desc(sql`1.0 - ${products.price} / ${products.compare_at_price}`),
        desc(products.created_at),
      ],
      limit,
    });
    return rows.map(toListItem);
  }, []);
}

/**
 * "Mais vendidos": units sold (order_items.qty) across confirmed orders —
 * paid and everything after it, never a pending, canceled or expired one.
 * Empty until the store has a confirmed sale, which hides the rail rather
 * than showing a "best seller" nobody bought. A best seller that has sold
 * out gives its slot to the next one.
 */
export async function getBestSellers(limit = 8): Promise<ProductListItem[]> {
  return safeQuery(async () => {
    const db = getDb();
    const units = sql<number>`sum(${order_items.qty})`;
    const ranking = await db
      .select({ id: order_items.product_id, units })
      .from(order_items)
      .innerJoin(orders, eq(orders.id, order_items.order_id))
      // Inner join: a product deleted since (product_id set null) or no
      // longer published doesn't take one of the slots.
      .innerJoin(products, eq(products.id, order_items.product_id))
      .where(and(inArray(orders.status, CONFIRMED_ORDER_STATUSES), isActive, hasStock))
      .groupBy(order_items.product_id)
      // A tie goes to the product that sold most recently.
      .orderBy(desc(units), desc(sql`max(${orders.created_at})`))
      .limit(limit);

    const ids = ranking.flatMap((row) => (row.id ? [row.id] : []));
    if (ids.length === 0) return [];

    const rows = await db.query.products.findMany({
      columns: LIST_COLUMNS,
      with: LIST_WITH,
      where: inArray(products.id, ids),
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [toListItem(row)] : [];
    });
  }, []);
}

export type ProductSort = "relevance" | "newest" | "price-asc" | "price-desc";

export type ProductListFilters = {
  /** Overrides the /colecao page size. */
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
      // "Relevância" is the store's own order: the products switched to
      // "Aparecer primeiro no catálogo" in the panel lead it. A sort the
      // shopper picks (above) is the only thing ordering the list.
      return [
        desc(products.featured),
        asc(products.position),
        // Position is 0 for nearly everything, so without this the tie
        // order is whatever the database felt like on each request.
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
    if (filters.onSale) conditions.push(isDiscounted);

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

/** "Você também pode gostar": same category, never the product being
 * viewed and never a sold-out one (a suggestion the shopper can't buy is
 * a dead end), in the catalog's own order. */
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
      where: and(
        isActive,
        hasStock,
        eq(products.category_id, categoryId),
        ne(products.id, excludeProductId),
      ),
      orderBy: [desc(products.featured), asc(products.position), desc(products.created_at)],
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
