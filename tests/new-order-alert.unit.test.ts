import { describe, expect, it } from "vitest";
import {
  buildNewOrderAlert,
  describeMercadoPagoPayment,
} from "@/lib/notifications/new-order";

const base = {
  orderNumber: 42,
  orderId: "abc",
  items: [
    {
      name: "Camiseta Oversized",
      color: "Preto",
      size: "G",
      qty: 2,
      unitPrice: 89.9,
    },
  ],
  subtotal: 179.8,
  shipping: 22.5,
  shippingMode: "charged",
  discount: 10,
  couponCode: "KING10",
  total: 192.3,
  customer: {
    name: "João <Silva>",
    phone: "86999998888",
    email: "joao@ex.com",
  },
  address: {
    cep: "64000000",
    street: "Rua A",
    number: "10",
    complement: "Apto 2",
    district: "Centro",
    city: "Teresina",
    state: "PI",
    freight: { service_id: 1, name: "PAC", company: "Correios", days: 5 },
  },
  paymentLabel: "Pix",
  origin: "https://sitekingstore.com.br",
};

describe("buildNewOrderAlert", () => {
  it("traz peça, variação, cliente, endereço e link", () => {
    const text = buildNewOrderAlert(base);
    expect(text).toContain("#42");
    expect(text).toContain("2x Camiseta Oversized");
    expect(text).toContain("Preto · G");
    expect(text).toContain("KING10");
    expect(text).toContain("Correios PAC");
    expect(text).toContain("João &lt;Silva&gt;");
    expect(text).toContain("(86) 99999-8888");
    expect(text).toContain("Teresina/PI");
    expect(text).toContain("CEP 64000-000");
    expect(text).toContain("https://sitekingstore.com.br/admin/pedidos/abc");
  });

  it("descreve a forma de pagamento", () => {
    expect(describeMercadoPagoPayment({ payment_method_id: "pix" })).toBe(
      "Pix",
    );
    expect(
      describeMercadoPagoPayment({
        payment_type_id: "credit_card",
        installments: 3,
      }),
    ).toBe("Cartão de crédito · 3x");
  });
});
