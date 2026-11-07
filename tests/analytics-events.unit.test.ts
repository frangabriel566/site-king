import { beforeEach, describe, expect, it } from "vitest";

/**
 * The dataLayer events, in a stand-in browser: what GTM receives and,
 * above all, what it must not receive twice.
 */

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

type FakeWindow = {
  dataLayer?: unknown[];
  localStorage: Storage;
  sessionStorage: Storage;
  location: { pathname: string };
};

const win = globalThis as unknown as { window: FakeWindow };

function setPath(pathname: string) {
  win.window.location.pathname = pathname;
}

function layer(): Record<string, unknown>[] {
  return (win.window.dataLayer ?? []) as Record<string, unknown>[];
}

function events(name: string) {
  return layer().filter((entry) => entry.event === name);
}

const events$ = await import("@/lib/analytics/events");
const { analyticsItemFromCart, analyticsItemFromOrderLine, analyticsItemFromProduct } = await import(
  "@/lib/analytics/items"
);

const item = analyticsItemFromCart({
  variantId: "v1",
  productId: "p1",
  slug: "moletom",
  name: "Moletom Coroa",
  color: "Preto",
  size: "M",
  price: 199.9,
  image: null,
  qty: 2,
});

beforeEach(() => {
  win.window = {
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage(),
    location: { pathname: "/" },
  };
});

describe("e-commerce events", () => {
  it("view_item: one product, BRL, ecommerce cleared before it", () => {
    events$.trackViewItem(
      analyticsItemFromProduct({
        id: "p1",
        name: "Moletom Coroa",
        price: 199.9,
        category: { name: "Moletons" },
        brand: { name: "King" },
      }),
    );
    expect(layer()[0]).toEqual({ ecommerce: null });
    expect(layer()[1]).toEqual({
      event: "view_item",
      ecommerce: {
        currency: "BRL",
        value: 199.9,
        items: [
          {
            item_id: "p1",
            item_name: "Moletom Coroa",
            item_category: "Moletons",
            item_brand: "King",
            price: 199.9,
            quantity: 1,
          },
        ],
      },
    });
  });

  it("add_to_cart: value is price × quantity, variant as 'Cor / Tamanho'", () => {
    events$.trackAddToCart(item);
    const [event] = events("add_to_cart");
    expect(event.ecommerce).toMatchObject({
      currency: "BRL",
      value: 399.8,
      items: [{ item_id: "p1", item_variant: "Preto / M", quantity: 2 }],
    });
  });

  it("begin_checkout: once per bag in the tab, again for a different bag", () => {
    expect(events$.trackBeginCheckout([item], "REI10")).toBe(true);
    expect(events$.trackBeginCheckout([item], "REI10")).toBe(false);
    expect(events$.trackBeginCheckout([{ ...item, quantity: 3 }])).toBe(true);
    expect(events("begin_checkout")).toHaveLength(2);
    expect(events("begin_checkout")[0].ecommerce).toMatchObject({ coupon: "REI10", value: 399.8 });
    expect(events$.trackBeginCheckout([])).toBe(false);
  });

  it("purchase: once per order, even when the page is opened again", () => {
    const purchase = {
      transactionId: "1042",
      value: 425.3,
      shipping: 25.5,
      discount: 0,
      coupon: null,
      items: [
        analyticsItemFromOrderLine({
          product_id: "p1",
          name: "Moletom Coroa",
          color: "Preto",
          size: "M",
          unit_price: 199.9,
          qty: 2,
        }),
      ],
    };
    expect(events$.trackPurchase(purchase)).toBe(true);
    expect(events$.trackPurchase(purchase)).toBe(false);
    expect(events$.trackPurchase({ ...purchase, transactionId: "1043" })).toBe(true);
    const sent = events("purchase");
    expect(sent).toHaveLength(2);
    expect(sent[0].ecommerce).toEqual({
      transaction_id: "1042",
      currency: "BRL",
      value: 425.3,
      shipping: 25.5,
      items: purchase.items,
    });
  });

  it("purchase keeps a bounded list of tracked orders", () => {
    for (let i = 0; i < 60; i++) {
      events$.trackPurchase({ transactionId: String(i), value: 1, shipping: 0, discount: 0, items: [] });
    }
    const kept = JSON.parse(win.window.localStorage.getItem("king-store:analytics:purchases")!);
    expect(kept).toHaveLength(50);
    expect(kept.at(-1)).toBe("59");
  });

  it("a deleted product keeps its name as id on the order", () => {
    expect(
      analyticsItemFromOrderLine({ product_id: null, name: "Boné", color: null, size: "U", unit_price: 50, qty: 1 })
        .item_id,
    ).toBe("Boné");
  });
});

describe("click_whatsapp", () => {
  it("names the spot, the page kind and — on a product page — the product", () => {
    setPath("/produto/moletom-coroa");
    events$.setCurrentProduct({ id: "p1", name: "Moletom Coroa" });
    events$.trackWhatsAppClick("produto_comprar");
    expect(events("click_whatsapp")[0]).toEqual({
      event: "click_whatsapp",
      link_location: "produto_comprar",
      page_type: "produto",
      page_path: "/produto/moletom-coroa",
      product_id: "p1",
      product_name: "Moletom Coroa",
    });
  });

  it("off the product page, no product is attached", () => {
    events$.setCurrentProduct({ id: "p1", name: "Moletom Coroa" });
    setPath("/sacola");
    events$.trackWhatsAppClick("sacola_finalizar");
    expect(events("click_whatsapp")[0]).toMatchObject({ page_type: "sacola", product_id: undefined });
  });

  it("is never an e-commerce event", () => {
    events$.trackWhatsAppClick("botao_flutuante");
    expect(layer().some((entry) => entry.event === "purchase")).toBe(false);
    expect(events("click_whatsapp")[0]).not.toHaveProperty("ecommerce");
  });

  it("counts chats with the store, not 'share on WhatsApp'", () => {
    expect(events$.isStoreWhatsAppLink("https://wa.me/5586999999999?text=Oi")).toBe(true);
    expect(events$.isStoreWhatsAppLink("https://api.whatsapp.com/send?phone=5586999999999")).toBe(true);
    expect(events$.isStoreWhatsAppLink("https://wa.me/?text=olha%20isso")).toBe(false);
    expect(events$.isStoreWhatsAppLink("https://instagram.com/kingstore")).toBe(false);
    expect(events$.isStoreWhatsAppLink("/produto/x")).toBe(false);
  });

  it("page kinds", () => {
    expect(events$.pageType("/")).toBe("home");
    expect(events$.pageType("/colecao")).toBe("colecao");
    expect(events$.pageType("/checkout")).toBe("checkout");
    expect(events$.pageType("/sobre")).toBe("institucional");
  });
});

describe("consent", () => {
  it("the bootstrap sets the default before loading GTM, denied until accepted", async () => {
    const { gtmBootstrapScript } = await import("@/lib/analytics/consent");
    const script = gtmBootstrapScript();
    expect(script.indexOf('gtag("consent", "default"')).toBeGreaterThan(-1);
    expect(script.indexOf('gtag("consent", "default"')).toBeLessThan(script.indexOf("gtm.js?id=GTM-WZ64DZLP"));
    expect(script).toContain('accepted ? "granted" : "denied"');
    expect(script).toContain("king-store:cookie-consent");
  });

  it("accepting updates consent through gtag", async () => {
    const calls: unknown[][] = [];
    (win.window as unknown as { gtag: (...args: unknown[]) => void }).gtag = (...args) => calls.push(args);
    win.window.dataLayer = [];
    const { grantAnalyticsConsent } = await import("@/lib/analytics/consent");
    grantAnalyticsConsent();
    expect(calls[0]).toEqual([
      "consent",
      "update",
      { analytics_storage: "granted", ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" },
    ]);
  });
});
