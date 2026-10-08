import { formatCurrency } from "@/lib/format";
import { roundMoney } from "@/lib/money";
import type { SiteSettings } from "@/lib/data/settings";

/**
 * The store's selling rules as the storefront needs them — from
 * Configurações → Vitrine (site_settings). Every field is optional and
 * every helper below returns null when its rule is not set: the
 * storefront never shows a condition the store hasn't defined.
 *
 * Plain functions on purpose — the cards are Client Components, the
 * checkout runs on the server, and both must agree to the cent.
 */
export type ShopConfig = {
  installmentsMax: number | null;
  pixDiscountPercent: number | null;
  freeShippingThreshold: number | null;
  newProductDays: number | null;
  lowStockUnits: number | null;
  freeShippingNote: string | null;
  exchangeNote: string | null;
  securePurchaseNote: string | null;
  /** How the store sells right now (lib/sales-mode.ts): whether the CEP
   * box quotes for real, and whether "Finalizar compra" goes to the
   * checkout or straight to the WhatsApp order. */
  freightQuotes: boolean;
  checkoutOpen: boolean;
  /** Server render time (ms). "Novo" is computed against this on the server
   * and again while hydrating, so the badge can't flip in between. */
  now: number;
};

export const EMPTY_SHOP_CONFIG: ShopConfig = {
  installmentsMax: null,
  pixDiscountPercent: null,
  freeShippingThreshold: null,
  newProductDays: null,
  lowStockUnits: null,
  freeShippingNote: null,
  exchangeNote: null,
  securePurchaseNote: null,
  freightQuotes: false,
  checkoutOpen: false,
  now: 0,
};

export function shopConfigFromSettings(
  settings: SiteSettings,
  sales: Pick<ShopConfig, "freightQuotes" | "checkoutOpen"> = {
    freightQuotes: false,
    checkoutOpen: false,
  },
  now = Date.now(),
): ShopConfig {
  return {
    freightQuotes: sales.freightQuotes,
    checkoutOpen: sales.checkoutOpen,
    installmentsMax: settings.installments_max,
    pixDiscountPercent: settings.pix_discount_percent,
    freeShippingThreshold: settings.free_shipping_threshold,
    newProductDays: settings.new_product_days,
    lowStockUnits: settings.low_stock_units,
    freeShippingNote: settings.free_shipping_note,
    exchangeNote: settings.exchange_note,
    // The version for how the store sells now (lib/sales-mode.ts): the
    // online one only with the checkout open, else the WhatsApp one.
    securePurchaseNote: sales.checkoutOpen
      ? settings.secure_purchase_note
      : settings.secure_purchase_note_whatsapp,
    now,
  };
}

/** Whole-percent discount from the "de" price, or null when there is none
 * worth showing. */
export function discountPercent(price: number, compareAtPrice: number | null): number | null {
  if (!compareAtPrice || compareAtPrice <= price) return null;
  const percent = Math.round((1 - price / compareAtPrice) * 100);
  return percent >= 1 ? percent : null;
}

/** "3x de R$ 33,30 sem juros" */
export function installmentText(price: number, installmentsMax: number | null): string | null {
  if (!installmentsMax || installmentsMax < 2 || price <= 0) return null;
  return `${installmentsMax}x de ${formatCurrency(price / installmentsMax)} sem juros`;
}

export function pixPrice(price: number, pixDiscountPercent: number | null): number | null {
  if (!pixDiscountPercent || pixDiscountPercent <= 0) return null;
  return roundMoney(price * (1 - pixDiscountPercent / 100));
}

export function isNewProduct(createdAt: string, newProductDays: number | null, now: number): boolean {
  if (!newProductDays || !now) return false;
  const created = new Date(createdAt).getTime();
  return Number.isFinite(created) && now - created <= newProductDays * 24 * 60 * 60 * 1000;
}

/** Stock summed over every variant, at or under the configured line. */
export function isLowStock(totalStock: number, lowStockUnits: number | null): boolean {
  return Boolean(lowStockUnits) && totalStock > 0 && totalStock <= (lowStockUnits ?? 0);
}

/** Shipping for a subtotal under the free-shipping rule. */
export function qualifiesForFreeShipping(subtotal: number, threshold: number | null): boolean {
  return threshold !== null && threshold > 0 && subtotal >= threshold;
}

export type TrustItemKind = "shipping" | "installments" | "exchange" | "secure";

/**
 * The reassurance lines (frete, parcelamento, trocas, compra segura), each
 * only when the store configured it. Callers pick which kinds they show;
 * the order is fixed.
 */
export function trustItems(
  config: ShopConfig,
  kinds: TrustItemKind[],
  overrides: Partial<Record<TrustItemKind, string | null>> = {},
): { kind: TrustItemKind; label: string }[] {
  const labels: Record<TrustItemKind, string | null> = {
    shipping: freeShippingText(config),
    installments:
      config.installmentsMax && config.installmentsMax >= 2
        ? `Parcele em até ${config.installmentsMax}x sem juros`
        : null,
    exchange: config.exchangeNote,
    secure: config.securePurchaseNote,
    ...overrides,
  };
  return kinds
    .map((kind) => ({ kind, label: labels[kind] }))
    .filter((item): item is { kind: TrustItemKind; label: string } => Boolean(item.label));
}

/** Limits of the rotating bar at the top (Configurações → Faixa de avisos).
 * Short enough to fit one line on a 375px phone without truncating much. */
export const ANNOUNCEMENT_MAX_MESSAGES = 6;
export const ANNOUNCEMENT_MAX_LENGTH = 90;

/** site_settings.announcement holds one message per line. */
export function splitAnnouncement(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * What the bar at the top rotates through: the store's own messages while
 * the bar is switched on, else the free-shipping line (the same text the
 * checkout honours), else nothing at all.
 */
export function announcementMessages(
  settings: Pick<
    SiteSettings,
    "announcement" | "announcement_active" | "free_shipping_threshold" | "free_shipping_note"
  >,
): string[] {
  const messages = settings.announcement_active ? splitAnnouncement(settings.announcement) : [];
  if (messages.length > 0) return messages.slice(0, ANNOUNCEMENT_MAX_MESSAGES);
  const shipping = freeShippingText({
    freeShippingThreshold: settings.free_shipping_threshold,
    freeShippingNote: settings.free_shipping_note,
  });
  return shipping ? [shipping] : [];
}

/** The trust strip's shipping line: the rule itself when there is one (so
 * it can never disagree with the checkout), else the store's own phrase. */
export function freeShippingText(config: Pick<ShopConfig, "freeShippingThreshold" | "freeShippingNote">): string | null {
  if (config.freeShippingThreshold) {
    return `Frete grátis acima de ${formatCurrency(config.freeShippingThreshold)}`;
  }
  return config.freeShippingNote;
}
