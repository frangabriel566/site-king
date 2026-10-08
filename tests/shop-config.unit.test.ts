import { describe, expect, it } from "vitest";
import { shopConfigFromSettings } from "@/lib/shop-config";
import type { SiteSettings } from "@/lib/data/settings";

const settings = {
  secure_purchase_note: "Pagamento processado pelo Mercado Pago",
  secure_purchase_note_whatsapp: "Pagamento combinado pelo WhatsApp",
} as SiteSettings;

describe("payment texts follow the sales mode", () => {
  it("shows the WhatsApp version while the checkout is closed", () => {
    const config = shopConfigFromSettings(settings, { freightQuotes: false, checkoutOpen: false });
    expect(config.securePurchaseNote).toBe("Pagamento combinado pelo WhatsApp");
  });

  it("shows the online version with the checkout open", () => {
    const config = shopConfigFromSettings(settings, { freightQuotes: true, checkoutOpen: true });
    expect(config.securePurchaseNote).toBe("Pagamento processado pelo Mercado Pago");
  });

  it("shows nothing rather than the online text when the WhatsApp one is empty", () => {
    const config = shopConfigFromSettings(
      { ...settings, secure_purchase_note_whatsapp: null },
      { freightQuotes: false, checkoutOpen: false },
    );
    expect(config.securePurchaseNote).toBeNull();
  });
});
