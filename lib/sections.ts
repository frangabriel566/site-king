/** The storefront's product shelves, picked per product in the panel
 * (product_sections). The order is the order on the home. No imports here:
 * the schema and the browser both read this list. */
export const PRODUCT_SECTIONS = ["lancamentos", "novidades", "ofertas", "mais_vendidos"] as const;
export type ProductSection = (typeof PRODUCT_SECTIONS)[number];

/** The storefront shelves as the shopper and the panel see them. */
export const SECTION_LABEL: Record<ProductSection, string> = {
  lancamentos: "Lançamentos",
  novidades: "Novidades",
  ofertas: "Ofertas",
  mais_vendidos: "Mais vendidos",
};

export function isProductSection(value: unknown): value is ProductSection {
  return typeof value === "string" && (PRODUCT_SECTIONS as readonly string[]).includes(value);
}

/** A shelf's "Ver tudo": the catalog showing only that shelf. */
export function sectionHref(section: ProductSection): string {
  return `/colecao?secao=${section}`;
}
