import { describe, expect, it } from "vitest";
import {
  orderSummaryLines,
  orderSummaryText,
  orderTotal,
  shippingModeFor,
  shippingText,
} from "@/lib/orders/summary";

// formatCurrency uses a no-break space after "R$".
const brl = (value: string) => `R$ ${value}`;

describe("shippingModeFor", () => {
  it("is free from the store's threshold, on the subtotal before the coupon", () => {
    expect(shippingModeFor(399, 399, false)).toBe("free");
    expect(shippingModeFor(398.99, 399, false)).toBe("to_agree");
  });

  it("is free with a free-shipping coupon, whatever the subtotal", () => {
    expect(shippingModeFor(50, 399, true)).toBe("free");
  });

  it("is a combinar when the store has no threshold", () => {
    expect(shippingModeFor(10_000, null, false)).toBe("to_agree");
    expect(shippingModeFor(10_000, 0, false)).toBe("to_agree");
  });
});

describe("orderSummaryLines", () => {
  it("prints freight a combinar and the products' total", () => {
    expect(
      orderSummaryLines({
        subtotal: 270,
        itemCount: 2,
        discount: 0,
        couponCode: null,
        shippingMode: "to_agree",
      }),
    ).toEqual([
      { kind: "subtotal", label: "Subtotal (2 itens)", value: brl("270,00") },
      { kind: "shipping", label: "Frete", value: "a combinar" },
      { kind: "total", label: "Total dos produtos", value: brl("270,00") },
    ]);
  });

  it("keeps 'Total dos produtos' with free shipping, and names the coupon", () => {
    expect(
      orderSummaryLines({
        subtotal: 420,
        itemCount: 1,
        discount: 42,
        couponCode: "DEZ",
        shippingMode: "free",
      }),
    ).toEqual([
      { kind: "subtotal", label: "Subtotal (1 item)", value: brl("420,00") },
      { kind: "discount", label: "Desconto (cupom DEZ)", value: `-${brl("42,00")}` },
      { kind: "shipping", label: "Frete", value: "grátis" },
      { kind: "total", label: "Total dos produtos", value: brl("378,00") },
    ]);
  });

  it("adds a charged freight and calls it Total", () => {
    const lines = orderSummaryLines({
      subtotal: 100,
      itemCount: 1,
      discount: 0,
      couponCode: null,
      shippingMode: "charged",
      shipping: 29.9,
    });
    expect(lines.at(-2)).toEqual({ kind: "shipping", label: "Frete", value: brl("29,90") });
    expect(lines.at(-1)).toEqual({ kind: "total", label: "Total", value: brl("129,90") });
  });

  it("prints a recorded order's own total", () => {
    const lines = orderSummaryLines({
      subtotal: 100,
      itemCount: 1,
      discount: 0,
      couponCode: null,
      shippingMode: "to_agree",
      total: 99.99,
    });
    expect(lines.at(-1)?.value).toBe(brl("99,99"));
  });
});

describe("orderTotal", () => {
  it("never goes below zero and ignores freight that isn't charged", () => {
    expect(orderTotal({ subtotal: 50, discount: 80, shippingMode: "to_agree" })).toBe(0);
    expect(orderTotal({ subtotal: 50, discount: 0, shippingMode: "free", shipping: 30 })).toBe(50);
    expect(orderTotal({ subtotal: 0.1, discount: 0, shippingMode: "charged", shipping: 0.2 })).toBe(0.3);
  });
});

describe("shippingText / orderSummaryText", () => {
  it("uses the same words as the bag, total in bold for WhatsApp", () => {
    expect(shippingText("to_agree")).toBe("a combinar");
    expect(shippingText("free")).toBe("grátis");
    expect(
      orderSummaryText({
        subtotal: 270,
        itemCount: 2,
        discount: 27,
        couponCode: "DEZ",
        shippingMode: "to_agree",
      }),
    ).toEqual([
      `Subtotal (2 itens): ${brl("270,00")}`,
      `Desconto (cupom DEZ): -${brl("27,00")}`,
      "Frete: a combinar",
      `*Total dos produtos: ${brl("243,00")}*`,
    ]);
  });
});
