/**
 * The store's analytics events, pushed to the GTM dataLayer
 * (GTM-WZ64DZLP → GA4 G-NPKKW846TD).
 *
 * Names and shapes follow GA4's recommended e-commerce events, so the
 * GA4 Event tag in GTM can forward them with "Send Ecommerce data" on and
 * GA4's item reports (Itens visualizados, Adicionados ao carrinho) fill
 * on their own:
 *
 * - view_item       product page opened (once per product per page view)
 * - add_to_cart     an item went into the bag (CartProvider.addItem)
 * - begin_checkout  the checkout opened with a bag (once per bag per tab)
 * - purchase        the order page showed an order confirmed as paid —
 *                   never on order creation; once per order per browser
 * - click_whatsapp  a WhatsApp conversation was opened from the site.
 *                   Not a sale: the panel counts sales from the orders.
 *
 * Only product and order data goes in — no names, e-mails, phones or
 * addresses. Whether GA4 may store anything is decided by Consent Mode
 * (lib/analytics/consent.ts), which GTM's tags honour.
 *
 * No `server-only`: everything here runs in the browser, and does nothing
 * outside it.
 */

export const CURRENCY = "BRL";

export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  /** "Preto / M". */
  item_variant?: string;
  item_brand?: string;
  item_category?: string;
  price: number;
  quantity: number;
};

type DataLayerWindow = Window & { dataLayer?: unknown[] };

function dataLayer(): unknown[] | null {
  if (typeof window === "undefined") return null;
  const w = window as DataLayerWindow;
  w.dataLayer = w.dataLayer || [];
  return w.dataLayer;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function itemsValue(items: AnalyticsItem[]): number {
  return round2(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
}

/** "Preto / M"; empty parts (one-size products) are dropped. */
export function variantLabel(color?: string | null, size?: string | null): string | undefined {
  const label = [color, size].map((part) => part?.trim()).filter(Boolean).join(" / ");
  return label || undefined;
}

/**
 * GA4's e-commerce push: the previous `ecommerce` object is cleared first,
 * as Google asks, so one event's items never leak into the next.
 */
function pushEcommerce(event: string, ecommerce: Record<string, unknown>) {
  safely(() => {
    const layer = dataLayer();
    if (!layer) return;
    layer.push({ ecommerce: null });
    layer.push({ event, ecommerce });
  });
}

/**
 * Tracking must never break what it tracks: these calls sit inside "add to
 * bag", the checkout and the WhatsApp order. Once GTM loads it replaces
 * `dataLayer.push` with its own, and a tag error must not reach the shopper.
 */
function safely(run: () => void) {
  try {
    run();
  } catch {
    // Lost event, kept sale.
  }
}

export function trackViewItem(item: AnalyticsItem) {
  pushEcommerce("view_item", { currency: CURRENCY, value: itemsValue([item]), items: [item] });
}

export function trackAddToCart(item: AnalyticsItem) {
  pushEcommerce("add_to_cart", { currency: CURRENCY, value: itemsValue([item]), items: [item] });
}

// --- begin_checkout ------------------------------------------------------

const CHECKOUT_KEY = "king-store:analytics:checkout";

/** The bag as a short string: same bag → same signature. */
export function bagSignature(items: Pick<AnalyticsItem, "item_id" | "item_variant" | "quantity">[]): string {
  return items
    .map((item) => `${item.item_id}|${item.item_variant ?? ""}|${item.quantity}`)
    .sort()
    .join(",");
}

/**
 * Once per bag per tab: reloading the checkout, or coming back to it from
 * the payment page, is the same checkout. A different bag is a new one.
 * Returns whether the event was pushed.
 */
export function trackBeginCheckout(items: AnalyticsItem[], coupon?: string | null): boolean {
  if (typeof window === "undefined" || items.length === 0) return false;
  const signature = bagSignature(items);
  try {
    if (window.sessionStorage.getItem(CHECKOUT_KEY) === signature) return false;
    window.sessionStorage.setItem(CHECKOUT_KEY, signature);
  } catch {
    // Storage blocked: count it; a duplicate beats a missing checkout.
  }
  pushEcommerce("begin_checkout", {
    currency: CURRENCY,
    value: itemsValue(items),
    ...(coupon ? { coupon } : {}),
    items,
  });
  return true;
}

// --- purchase ------------------------------------------------------------

const PURCHASES_KEY = "king-store:analytics:purchases";
/** Enough to cover any shopper's recent orders; the list never grows past it. */
const PURCHASES_KEPT = 50;

function readTracked(): string[] {
  try {
    const raw = window.localStorage.getItem(PURCHASES_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export type PurchaseData = {
  transactionId: string;
  value: number;
  shipping: number;
  discount: number;
  coupon?: string | null;
  items: AnalyticsItem[];
};

/**
 * Once per order per browser: the order page can be reopened (the e-mail
 * link, a reload, the back button) and every visit would otherwise be a
 * new sale in GA4. GA4 also drops repeats of a transaction_id from the same
 * user, which covers what a cleared browser lets through.
 * Returns whether the event was pushed.
 */
export function trackPurchase(data: PurchaseData): boolean {
  if (typeof window === "undefined") return false;
  const tracked = readTracked();
  if (tracked.includes(data.transactionId)) return false;
  try {
    window.localStorage.setItem(
      PURCHASES_KEY,
      JSON.stringify([...tracked, data.transactionId].slice(-PURCHASES_KEPT)),
    );
  } catch {
    // Storage blocked: GA4's own transaction_id dedupe is what is left.
  }
  pushEcommerce("purchase", {
    transaction_id: data.transactionId,
    currency: CURRENCY,
    value: round2(data.value),
    shipping: round2(data.shipping),
    ...(data.discount > 0 ? { discount: round2(data.discount) } : {}),
    ...(data.coupon ? { coupon: data.coupon } : {}),
    items: data.items,
  });
  return true;
}

// --- click_whatsapp ------------------------------------------------------

/** Where on the site the conversation was opened from. */
export type WhatsAppOrigin =
  | "botao_flutuante"
  | "produto_comprar"
  | "sacola_finalizar"
  | "checkout"
  | "cabecalho"
  | "rodape"
  | "pagina"
  | "outro";

/** The page kind, from the path — what GA4 groups the clicks by. */
export function pageType(pathname: string): string {
  if (pathname === "/") return "home";
  const first = pathname.split("/")[1] ?? "";
  const known: Record<string, string> = {
    produto: "produto",
    colecao: "colecao",
    marca: "marca",
    sacola: "sacola",
    checkout: "checkout",
    pedido: "pedido",
    conta: "conta",
  };
  return known[first] ?? "institucional";
}

/** The product on screen, set by the product page while it is open, so a
 * WhatsApp click there says which product it was about. */
let currentProduct: { id: string; name: string } | null = null;

export function setCurrentProduct(product: { id: string; name: string } | null) {
  currentProduct = product;
}

export function trackWhatsAppClick(origin: WhatsAppOrigin, product?: { id: string; name: string } | null) {
  safely(() => {
    const layer = dataLayer();
    if (!layer) return;
    const path = window.location.pathname;
    const onProduct = product ?? (pageType(path) === "produto" ? currentProduct : null);
    layer.push({
      event: "click_whatsapp",
      link_location: origin,
      page_type: pageType(path),
      page_path: path,
      product_id: onProduct?.id ?? undefined,
      product_name: onProduct?.name ?? undefined,
    });
  });
}

/**
 * Opens the blank tab a WhatsApp order will be sent to, counting the click
 * first — both inside the shopper's click.
 *
 * The order is created after this (a server round trip), and by then the
 * new tab is in front: on a phone the store's page is already in the
 * background. GA4 batches its hits and flushes the batch when the page is
 * hidden; a hit queued *after* that sits on a timer the browser freezes in
 * a background tab, and is never sent. Pushed here, while the page is
 * still visible, the tag fires at once and the switch to the new tab is
 * what sends it.
 */
export function openWhatsAppTab(origin: WhatsAppOrigin): Window | null {
  trackWhatsAppClick(origin);
  return window.open("", "_blank");
}

/**
 * A link that opens a chat with the store: wa.me/<number> or
 * api.whatsapp.com/send?phone=. A "share on WhatsApp" link (no number) is
 * the shopper sending the page to someone else, not talking to the store.
 */
export function isStoreWhatsAppLink(href: string): boolean {
  try {
    const url = new URL(href);
    if (url.hostname === "wa.me") return /^\/\d{8,}/.test(url.pathname);
    if (url.hostname === "api.whatsapp.com" || url.hostname === "web.whatsapp.com") {
      return /\d{8,}/.test(url.searchParams.get("phone") ?? "");
    }
    return false;
  } catch {
    return false;
  }
}
