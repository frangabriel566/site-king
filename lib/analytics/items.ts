import { SIMPLE_VARIANT_SIZE } from "@/lib/constants";
import type { CartItem } from "@/lib/cart/types";
import { variantLabel, type AnalyticsItem } from "./events";

/**
 * The store's own records as GA4 items. `item_id` is the product's id
 * everywhere (product page, bag, order), so GA4 adds up one product's
 * views, adds and purchases under one row whichever color or size.
 */

/** The one-size placeholder ("U" or similar) is not a size to report. */
function sizeLabel(size: string | null | undefined): string | null {
  return size && size !== SIMPLE_VARIANT_SIZE ? size : null;
}

export function analyticsItemFromCart(item: CartItem): AnalyticsItem {
  return {
    item_id: item.productId,
    item_name: item.name,
    item_variant: variantLabel(item.color, sizeLabel(item.size)),
    price: item.price,
    quantity: item.qty,
  };
}

export function analyticsItemFromProduct(product: {
  id: string;
  name: string;
  price: number;
  category?: { name: string } | null;
  brand?: { name: string } | null;
}): AnalyticsItem {
  return {
    item_id: product.id,
    item_name: product.name,
    item_category: product.category?.name ?? undefined,
    item_brand: product.brand?.name ?? undefined,
    price: product.price,
    quantity: 1,
  };
}

export function analyticsItemFromOrderLine(line: {
  product_id: string | null;
  name: string;
  color: string | null;
  size: string | null;
  unit_price: number;
  qty: number;
}): AnalyticsItem {
  return {
    // A product deleted since keeps its name on the order, not its id.
    item_id: line.product_id ?? line.name,
    item_name: line.name,
    item_variant: variantLabel(line.color, sizeLabel(line.size)),
    price: line.unit_price,
    quantity: line.qty,
  };
}
