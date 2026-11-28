import { describe, expect, it } from "vitest";
import { isLightColor, parseBannerStyle, resolveBannerColors } from "@/lib/banner-style";

describe("cores automáticas do banner", () => {
  it("vêm ligadas em banner já salvo sem o campo", () => {
    const style = parseBannerStyle(JSON.stringify({ bgColor: "#FFFFFF", textColor: "#FFFFFF" }));
    expect(style.autoColors).toBe(true);
  });

  it("fundo claro: textos e botão escuros", () => {
    const colors = resolveBannerColors(parseBannerStyle(JSON.stringify({ bgColor: "#FFFFFF", textColor: "#FFFFFF" })));
    expect(colors.textColor).toBe("#0A0A0A");
    expect(colors.highlightColor).toBe("#0A0A0A");
    expect(colors.buttonColor).toBe("#0A0A0A");
    expect(colors.buttonTextColor).toBe("#FFFFFF");
  });

  it("fundo escuro: textos claros", () => {
    const colors = resolveBannerColors(parseBannerStyle(JSON.stringify({ bgColor: "#0A0A0A", highlightColor: "#000000" })));
    expect(colors.textColor).toBe("#FFFFFF");
    expect(colors.highlightColor).toBe("#FFFFFF");
  });

  it("desligadas: usa as cores escolhidas", () => {
    const colors = resolveBannerColors(
      parseBannerStyle(JSON.stringify({ autoColors: false, bgColor: "#FFFFFF", textColor: "#FF0000" })),
    );
    expect(colors.textColor).toBe("#FF0000");
  });

  it("isLightColor", () => {
    expect(isLightColor("#FFFFFF")).toBe(true);
    expect(isLightColor("#0A0A0A")).toBe(false);
    expect(isLightColor("#D4AF37")).toBe(true);
  });
});
