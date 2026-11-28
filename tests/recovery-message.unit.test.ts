import { describe, expect, it } from "vitest";
import {
  buildRecoveryMessage,
  customerWhatsAppNumber,
  isRecoverableOrder,
} from "@/lib/orders/recovery-message";

describe("customerWhatsAppNumber", () => {
  it("adiciona 55 a um telefone com DDD", () => {
    expect(customerWhatsAppNumber("(86) 99999-1234")).toBe("5586999991234");
    expect(customerWhatsAppNumber("8633221100")).toBe("558633221100");
  });
  it("mantém o número que já vem com 55", () => {
    expect(customerWhatsAppNumber("+55 86 99999-1234")).toBe("5586999991234");
  });
  it("recusa telefone vazio ou incompleto", () => {
    expect(customerWhatsAppNumber("")).toBeNull();
    expect(customerWhatsAppNumber(undefined)).toBeNull();
    expect(customerWhatsAppNumber("99999")).toBeNull();
  });
});

describe("isRecoverableOrder", () => {
  it("só vale para compra não finalizada", () => {
    expect(isRecoverableOrder("pending")).toBe(true);
    expect(isRecoverableOrder("aguardando_whatsapp")).toBe(true);
    expect(isRecoverableOrder("expirado")).toBe(true);
    expect(isRecoverableOrder("paid")).toBe(false);
    expect(isRecoverableOrder("canceled")).toBe(false);
  });
});

describe("buildRecoveryMessage", () => {
  const base = {
    customerName: "JOÃO silva",
    storeName: "GC Concept",
    orderCode: "A1B2",
    items: [{ name: "Camiseta Oversized", qty: 2 }],
    total: "R$ 199,80",
  };

  it("cita o pagamento que não foi concluído no Mercado Pago", () => {
    const msg = buildRecoveryMessage({ ...base, status: "pending" });
    expect(msg).toContain("Oi, João!");
    expect(msg).toContain("2x Camiseta Oversized");
    expect(msg).toContain("pagamento não foi concluído");
    expect(msg).toContain("#A1B2");
    expect(msg).toContain("frete");
  });

  it("resume muitos itens", () => {
    const msg = buildRecoveryMessage({
      ...base,
      status: "expirado",
      items: [
        { name: "A", qty: 1 },
        { name: "B", qty: 1 },
        { name: "C", qty: 1 },
        { name: "D", qty: 1 },
      ],
    });
    expect(msg).toContain("A, B e mais 2 itens");
    expect(msg).toContain("expirando");
  });

  it("cumprimenta sem nome quando não há nome", () => {
    expect(buildRecoveryMessage({ ...base, customerName: null, status: "aguardando_whatsapp" })).toMatch(
      /^Oi! Tudo bem\?/,
    );
  });
});
