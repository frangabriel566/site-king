/** How an order's freight stands (orders.shipping_mode). No imports here:
 * the schema and the browser both read this list.
 *
 * - `to_agree` — "a combinar": the store quotes it in the WhatsApp
 *   conversation, so `orders.shipping` is 0 and the total is the products'.
 * - `free` — the store's rule (Configurações → Vitrine) or a coupon covers it.
 * - `charged` — `orders.shipping` holds what was charged: the old fixed
 *   checkout table, and the Melhor Envio quote once the checkout uses it. */
export const SHIPPING_MODES = ["to_agree", "free", "charged"] as const;
export type ShippingMode = (typeof SHIPPING_MODES)[number];
