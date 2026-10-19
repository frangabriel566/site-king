import { describe, expect, it } from "vitest";
import { isOneSizeCategory } from "@/lib/variants";
import { formatVariantLabel } from "@/lib/format";

describe("isOneSizeCategory", () => {
  it("reconhece bonés, chapéus e afins", () => {
    for (const name of ["Boné", "Bonés", "BONÉS", "Bone", "Chapéus", "Touca", "Viseira"]) {
      expect(isOneSizeCategory(name)).toBe(true);
    }
  });
  it("não pega outras categorias", () => {
    for (const name of ["Camisetas", "Bermudas", "Tênis", "Bonecas"]) {
      expect(isOneSizeCategory(name)).toBe(false);
    }
  });
});

describe("formatVariantLabel com tamanho único", () => {
  it("mostra só a cor", () => {
    expect(formatVariantLabel("Azul", "U")).toBe("Azul");
  });
});
