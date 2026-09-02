import type { ProductListFilters, ProductSort } from "@/lib/data/products";

const SORT_MAP: Record<string, ProductSort> = {
  novidades: "newest",
  "menor-preco": "price-asc",
  "maior-preco": "price-desc",
};

export const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "relevancia", label: "Relevância" },
  { value: "novidades", label: "Mais novos" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
];

export type CollectionSearchParams = {
  categoria?: string;
  marca?: string;
  tamanho?: string;
  cor?: string;
  preco_min?: string;
  preco_max?: string;
  promocao?: string;
  ordenar?: string;
  pagina?: string;
  densidade?: string;
};

export function parseCollectionParams(
  params: CollectionSearchParams,
): ProductListFilters {
  return {
    category: params.categoria || undefined,
    brand: params.marca || undefined,
    sizes: params.tamanho ? params.tamanho.split(",").filter(Boolean) : undefined,
    colors: params.cor ? params.cor.split(",").filter(Boolean) : undefined,
    minPrice: params.preco_min ? Number(params.preco_min) : undefined,
    maxPrice: params.preco_max ? Number(params.preco_max) : undefined,
    onSale: params.promocao === "1" || undefined,
    sort: params.ordenar ? SORT_MAP[params.ordenar] : undefined,
    page: params.pagina ? Number(params.pagina) : 1,
  };
}
