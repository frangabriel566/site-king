import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import type { Tables, ProductBadge } from "@/lib/database.types";
import {
  COLLECTION_PAGE_SIZE,
  SIZE_ORDER,
  isColorlessVariant,
  isSimpleVariant,
} from "@/lib/constants";
import { buildGallerySlides, getProductColors } from "@/lib/product-gallery";
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
};

const LIST_SELECT =
  "id, slug, name, price, compare_at_price, created_at, position, badge, brand:brands(id, name, slug), product_images(id, url, alt, position), product_variants(id, color, color_hex, size, stock, image_url)";

function toListItem(row: {
  id: string;
  slug: string;
  name: string;
  price: number;
  compare_at_price: number | null;
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
  const supabase = createPublicClient();

  const { data } = await supabase
    .from("products")
    .select(LIST_SELECT)
    .eq("status", "active")
    .eq("badge", badgeValue)
    .order("featured", { ascending: false })
    .order(orderColumn, { ascending: orderColumn === "position" })
    // Every product starts at position 0, so ordering by position alone
    // leaves Postgres free to hand back ties in a different order on every
    // request — a new product landed inside or outside the rail at random.
    // Newest wins a tie, which also puts a just-registered product first.
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map(toListItem);
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

async function resolveVariantFilteredIds(
  filters: Pick<ProductListFilters, "sizes" | "colors">,
): Promise<string[] | null> {
  if (!filters.sizes?.length && !filters.colors?.length) return null;

  const supabase = createPublicClient();
  let query = supabase.from("product_variants").select("product_id");
  if (filters.sizes?.length) query = query.in("size", filters.sizes);
  if (filters.colors?.length) query = query.in("color", filters.colors);

  const { data } = await query;
  return Array.from(new Set((data ?? []).map((v) => v.product_id)));
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
    const supabase = createPublicClient();

    const variantIds = await resolveVariantFilteredIds(filters);
    if (variantIds !== null && variantIds.length === 0) {
      return emptyResult;
    }

    let query = supabase
      .from("products")
      .select(LIST_SELECT, { count: "exact" })
      .eq("status", "active");

    if (filters.excludeBadged) query = query.is("badge", null);

    if (filters.category) {
      const { data: category } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", filters.category)
        .maybeSingle();

      if (!category) {
        return emptyResult;
      }
      query = query.eq("category_id", category.id);
    }

    if (filters.brand) {
      const { data: brand } = await supabase
        .from("brands")
        .select("id")
        .eq("slug", filters.brand)
        .maybeSingle();

      if (!brand) {
        return emptyResult;
      }
      query = query.eq("brand_id", brand.id);
    }

    if (variantIds) query = query.in("id", variantIds);
    if (filters.minPrice !== undefined) query = query.gte("price", filters.minPrice);
    if (filters.maxPrice !== undefined) query = query.lte("price", filters.maxPrice);
    if (filters.onSale) query = query.not("compare_at_price", "is", null);

    switch (filters.sort) {
      case "newest":
        query = query.order("created_at", { ascending: false });
        break;
      case "price-asc":
        query = query.order("price", { ascending: true });
        break;
      case "price-desc":
        query = query.order("price", { ascending: false });
        break;
      default:
        if (filters.featuredFirst) query = query.order("featured", { ascending: false });
        query = query.order("position", { ascending: true });
        // See fetchRail: position is 0 for nearly everything, so without
        // this the tie order is whatever the database felt like.
        query = query.order("created_at", { ascending: false });
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count } = await query.range(from, to);

    const total = count ?? 0;
    return {
      items: (data ?? []).map(toListItem),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }, emptyResult);
}

export async function getProductBySlug(
  slug: string,
): Promise<ProductWithRelations | null> {
  return safeQuery(async () => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("products")
      .select(
        "*, product_images(*), product_variants(*), category:categories(id, name, slug), brand:brands(id, name, slug, logo_url)",
      )
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();

    return data as ProductWithRelations | null;
  }, null);
}

export async function getRelatedProducts(
  categoryId: string | null,
  excludeProductId: string,
  limit = 4,
): Promise<ProductListItem[]> {
  if (!categoryId) return [];
  return safeQuery(async () => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("products")
      .select(LIST_SELECT)
      .eq("status", "active")
      .eq("category_id", categoryId)
      .neq("id", excludeProductId)
      .limit(limit);

    return (data ?? []).map(toListItem);
  }, []);
}

export type AdminProductListItem = Tables<"products"> & {
  category: Pick<Category, "id" | "name"> | null;
  brand: Pick<Brand, "id" | "name"> | null;
  product_images: Pick<ProductImage, "url">[];
  product_variants: Pick<ProductVariant, "id" | "stock" | "image_url">[];
};

/** Admin listing — every status, session-scoped RLS. */
export async function getAllProductsAdmin(): Promise<AdminProductListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "*, category:categories(id, name), brand:brands(id, name), product_images(url), product_variants(id, stock, image_url)",
    )
    .order("position", { ascending: true });

  return (data as AdminProductListItem[] | null) ?? [];
}

/**
 * Every SKU already in use, across every product except the one being
 * edited. `sku` is unique DB-wide (not per-product), but the admin form's
 * auto-generator only dedupes against the variants already on screen —
 * without this, two different products can independently land on the
 * same generated SKU and only find out when the save is rejected.
 */
/** Every slug already taken, so the form can settle on a free one while
 * the operator types instead of failing on the unique index at save. */
export async function getAllProductSlugs(excludeProductId?: string): Promise<string[]> {
  const supabase = await createClient();
  let query = supabase.from("products").select("slug");
  if (excludeProductId) query = query.neq("id", excludeProductId);

  const { data } = await query;
  return (data ?? []).map((product) => product.slug);
}

export async function getAllVariantSkus(excludeProductId?: string): Promise<string[]> {
  const supabase = await createClient();
  let query = supabase.from("product_variants").select("sku, product_id");
  if (excludeProductId) query = query.neq("product_id", excludeProductId);

  const { data } = await query;
  return (data ?? []).map((v) => v.sku).filter((sku): sku is string => sku !== null);
}

export type ProductOption = Pick<
  Tables<"products">,
  "id" | "name" | "slug" | "description" | "price"
>;

export async function getProductOptions(): Promise<ProductOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, slug, description, price")
    .order("name", { ascending: true });

  return data ?? [];
}

export async function getProductByIdAdmin(
  id: string,
): Promise<ProductWithRelations | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "*, product_images(*), product_variants(*), category:categories(id, name, slug), brand:brands(id, name, slug, logo_url)",
    )
    .eq("id", id)
    .maybeSingle();

  return data as ProductWithRelations | null;
}

/** Products for the /marca/[slug] storefront page. */
export async function getProductsByBrand(brandId: string): Promise<ProductListItem[]> {
  return safeQuery(async () => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("products")
      .select(LIST_SELECT)
      .eq("status", "active")
      .eq("brand_id", brandId)
      .order("position", { ascending: true });

    return (data ?? []).map(toListItem);
  }, []);
}

export async function getAllActiveProductSlugs(): Promise<string[]> {
  return safeQuery(async () => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("products")
      .select("slug")
      .eq("status", "active");

    return (data ?? []).map((p) => p.slug);
  }, []);
}

export async function searchProducts(term: string, limit = 8): Promise<ProductListItem[]> {
  const trimmed = term.trim();
  if (trimmed.length < 2) return [];

  return safeQuery(async () => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("products")
      .select(LIST_SELECT)
      .eq("status", "active")
      .ilike("name", `%${trimmed}%`)
      .limit(limit);

    return (data ?? []).map(toListItem);
  }, []);
}

export type FilterOptions = {
  sizes: string[];
  colors: { color: string; color_hex: string | null }[];
};

export async function getFilterOptions(): Promise<FilterOptions> {
  const fallback: FilterOptions = { sizes: [], colors: [] };
  return safeQuery(async () => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("product_variants")
      .select("size, color, color_hex, products!inner(status)")
      .eq("products.status", "active");

    const sizeSet = new Set<string>();
    const colorMap = new Map<string, string | null>();
    for (const row of data ?? []) {
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
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("products")
      .select("price")
      .eq("status", "active")
      .order("price", { ascending: true });

    if (!data || data.length === 0) return fallback;
    return { min: data[0].price, max: data[data.length - 1].price };
  }, fallback);
}
