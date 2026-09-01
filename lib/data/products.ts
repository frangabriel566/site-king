import { createPublicClient } from "@/lib/supabase/public";
import type { Tables } from "@/lib/database.types";
import { COLLECTION_PAGE_SIZE } from "@/lib/constants";
import { safeQuery } from "./safe";

export type ProductImage = Tables<"product_images">;
export type ProductVariant = Tables<"product_variants">;
export type Category = Tables<"categories">;

export type ProductWithRelations = Tables<"products"> & {
  product_images: ProductImage[];
  product_variants: ProductVariant[];
  category: Pick<Category, "id" | "name" | "slug"> | null;
};

type ListImage = Pick<ProductImage, "id" | "url" | "alt" | "position">;
type ListVariant = Pick<
  ProductVariant,
  "id" | "color" | "color_hex" | "size" | "stock"
>;

export type ProductListItem = {
  id: string;
  slug: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  image: ListImage | null;
  colors: { color: string; color_hex: string | null }[];
  inStock: boolean;
};

const LIST_SELECT =
  "id, slug, name, price, compare_at_price, created_at, position, product_images(id, url, alt, position), product_variants(id, color, color_hex, size, stock)";

function toListItem(row: {
  id: string;
  slug: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  product_images: ListImage[];
  product_variants: ListVariant[];
}): ProductListItem {
  const sortedImages = [...row.product_images].sort(
    (a, b) => a.position - b.position,
  );
  const colorMap = new Map<string, string | null>();
  let inStock = false;
  for (const variant of row.product_variants) {
    if (!colorMap.has(variant.color)) colorMap.set(variant.color, variant.color_hex);
    if (variant.stock > 0) inStock = true;
  }

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    price: row.price,
    compare_at_price: row.compare_at_price,
    image: sortedImages[0] ?? null,
    colors: Array.from(colorMap, ([color, color_hex]) => ({ color, color_hex })),
    inStock,
  };
}

export async function getFeaturedProducts(limit = 4): Promise<ProductListItem[]> {
  return safeQuery(async () => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("products")
      .select(LIST_SELECT)
      .eq("status", "active")
      .eq("featured", true)
      .order("position", { ascending: true })
      .limit(limit);

    return (data ?? []).map(toListItem);
  }, []);
}

export type ProductSort = "relevance" | "newest" | "price-asc" | "price-desc";

export type ProductListFilters = {
  category?: string;
  sizes?: string[];
  colors?: string[];
  minPrice?: number;
  maxPrice?: number;
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
  const pageSize = COLLECTION_PAGE_SIZE;
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

    if (variantIds) query = query.in("id", variantIds);
    if (filters.minPrice !== undefined) query = query.gte("price", filters.minPrice);
    if (filters.maxPrice !== undefined) query = query.lte("price", filters.maxPrice);

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
        query = query.order("position", { ascending: true });
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
        "*, product_images(*), product_variants(*), category:categories(id, name, slug)",
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
