/**
 * Lowercase, accents stripped, whitespace collapsed — so "Calça", "CALÇA"
 * and "calca" all become "calca".
 *
 * SQLite's LIKE only folds case for ASCII, so "Ç" and "ç" would never
 * match each other there. Instead both sides are normalized here: the
 * stored `products.search_text` on save, and the shopper's term at search.
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** What a product is findable by: its name, brand and category. */
export function buildProductSearchText(parts: {
  name: string;
  brandName?: string | null;
  categoryName?: string | null;
}): string {
  return normalizeSearchText(
    [parts.name, parts.brandName, parts.categoryName].filter(Boolean).join(" "),
  );
}
