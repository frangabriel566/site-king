/**
 * How a counter sale was paid. Its own module (no drizzle) so the sale
 * form in the browser can list them; lib/db/schema.ts imports it relatively
 * because drizzle-kit reads that file too.
 */
export const STORE_PAYMENT_METHODS = ["dinheiro", "pix", "debito", "credito", "outro"] as const;
export type StorePaymentMethod = (typeof STORE_PAYMENT_METHODS)[number];

export const STORE_PAYMENT_LABEL: Record<StorePaymentMethod, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  debito: "Débito",
  credito: "Crédito",
  outro: "Outro",
};
