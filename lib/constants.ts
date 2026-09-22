export const CART_STORAGE_KEY = "king-store:cart";
export const COOKIE_CONSENT_KEY = "king-store:cookie-consent";
/** Fired on `window` the moment cookie consent is accepted, so other
 * already-mounted widgets (e.g. the WhatsApp float, which raises itself
 * to clear the cookie banner) can react in the same tab — a `storage`
 * event only fires in *other* tabs, so it can't do this job. */
export const COOKIE_CONSENT_EVENT = "king-store:cookie-consent-change";
export const COLLECTION_PAGE_SIZE = 12;

/**
 * How many products each home rail holds.
 *
 * Deliberately generous: the rails drag sideways now, so a long one costs
 * nothing but a swipe, while a short one silently hides stock the store
 * just published. Paired with the created_at tie-break in lib/data/products,
 * it is what makes "cadastrou, aparece na home" true — a product registered
 * today sorts to the front of its rail, so it is visible whether or not the
 * catalogue has outgrown this number.
 */
export const HOME_RAIL_LIMIT = 24;

export const FREE_SHIPPING_THRESHOLD = 399;

export const SHIPPING_METHODS = {
  standard: {
    label: "Padrão",
    price: 29.9,
    etaDays: "5 a 8 dias úteis",
  },
  express: {
    label: "Expressa",
    price: 49.9,
    etaDays: "2 a 3 dias úteis",
  },
} as const;

export type ShippingMethod = keyof typeof SHIPPING_METHODS;

/**
 * Where the shopper finishes paying. Both paths build the *same* order —
 * same items, same address, same stock rules — so a sale closed over
 * WhatsApp still lands in Pedidos and still waits on the admin to mark it
 * paid before stock moves. Only the last step differs.
 *
 * This is the shopper's choice, not the store's. The store's side of it is
 * PAYMENT_PROVIDER, which says whether an online checkout exists to offer
 * at all — see getPaymentProvider().
 */
export const CHECKOUT_METHODS = {
  site: {
    label: "Pagar pelo site",
    description: "Cartão, Pix ou boleto pelo Mercado Pago.",
  },
  whatsapp: {
    label: "Finalizar no WhatsApp",
    description: "Você combina o pagamento direto com a loja.",
  },
} as const;

export type CheckoutMethod = keyof typeof CHECKOUT_METHODS;

/** Pre-selects the method on the checkout's payment step. Nothing in the
 * storefront links with it today — the choice is made on that step itself —
 * so it exists for an external link (a campaign, a WhatsApp broadcast) that
 * wants to land the shopper on one option already picked. */
export const CHECKOUT_METHOD_PARAM = "via";

export function isCheckoutMethod(value: unknown): value is CheckoutMethod {
  return value === "site" || value === "whatsapp";
}

export const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XG", "U"] as const;

export const LOW_STOCK_THRESHOLD = 5;

/** A "produto sem variações" is stored as a single product_variants row
 * with this exact color/size pair — reuses every bit of existing
 * variant/cart/order/stock-decrement plumbing instead of a second,
 * parallel stock system. Storefront/admin display code hides this
 * pair rather than showing it as a real color or size. */
export const SIMPLE_VARIANT_COLOR = "Padrão";
export const SIMPLE_VARIANT_SIZE = "U";

export function isSimpleVariant(color: string, size: string): boolean {
  return color === SIMPLE_VARIANT_COLOR && size === SIMPLE_VARIANT_SIZE;
}

/**
 * A product sold in sizes but in a single colourway (one photo, P–XG)
 * stores every row under the same sentinel colour, so the shopper gets a
 * real size picker with per-size stock while no colour swatch is shown.
 * `isSimpleVariant` above is the narrower case: sentinel colour *and*
 * sentinel size, i.e. nothing for the shopper to pick at all.
 */
export function isColorlessVariant(color: string): boolean {
  return color === SIMPLE_VARIANT_COLOR;
}
