export const CART_STORAGE_KEY = "king-store:cart";
export const COOKIE_CONSENT_KEY = "king-store:cookie-consent";
export const COLLECTION_PAGE_SIZE = 12;

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

export const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XG", "U"] as const;

export const LOW_STOCK_THRESHOLD = 5;
