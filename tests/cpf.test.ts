import { describe, expect, it } from "vitest";
import { formatCpf, isValidCpf } from "@/lib/validations/cpf";

describe("CPF", () => {
  it("aceita CPF com dígitos verificadores corretos, com ou sem máscara", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });

  it("recusa dígito errado, repetidos e tamanho errado", () => {
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("5299822472")).toBe(false);
    expect(isValidCpf("")).toBe(false);
  });

  it("formata enquanto digita", () => {
    expect(formatCpf("529")).toBe("529");
    expect(formatCpf("5299")).toBe("529.9");
    expect(formatCpf("5299822")).toBe("529.982.2");
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatCpf("529982247251234")).toBe("529.982.247-25");
  });
});
