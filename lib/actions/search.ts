"use server";

import { searchProducts, type ProductListItem } from "@/lib/data/products";

export async function searchProductsAction(
  term: string,
): Promise<ProductListItem[]> {
  return searchProducts(term);
}
