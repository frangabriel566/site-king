"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Wand2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { slugify } from "@/lib/format";

export type VariantDraft = {
  clientId: string;
  color: string;
  color_hex: string;
  size: string;
  sku: string;
  /** true once the operator has typed into the SKU field directly — the
   * auto-generator then leaves it alone. */
  skuManual: boolean;
  stock: number;
  weight_grams: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
};

export type StandardMeasurements = {
  weight_grams: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
};

const SIZE_PRESETS = {
  numeric: {
    label: "Numérico (36–44)",
    sizes: ["36", "37", "38", "39", "40", "41", "42", "43", "44"],
  },
  letters: {
    label: "Letras (PP–XGG)",
    sizes: ["PP", "P", "M", "G", "GG", "XGG"],
  },
  single: {
    label: "Único",
    sizes: ["U"],
  },
} as const;

function newClientId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildSkuBase(productSlug: string, color: string, size: string): string {
  const parts = [productSlug, color, size].filter((p) => p && p.trim());
  if (parts.length === 0) return "";
  return slugify(parts.join(" ")).toUpperCase();
}

function withUniqueSuffix(base: string, clientId: string, taken: Set<string>): string {
  if (!base || !taken.has(base)) return base;
  const suffix = clientId.replace(/-/g, "").slice(-4).toUpperCase();
  return `${base}-${suffix}`;
}

function autoSku(
  row: Pick<VariantDraft, "clientId" | "color" | "size">,
  productSlug: string,
  siblingSkus: Set<string>,
): string {
  const base = buildSkuBase(productSlug, row.color, row.size);
  return withUniqueSuffix(base, row.clientId, siblingSkus);
}

export function makeEmptyVariant(defaults: StandardMeasurements): VariantDraft {
  return {
    clientId: newClientId(),
    color: "",
    color_hex: "",
    size: "",
    sku: "",
    skuManual: false,
    stock: 0,
    ...defaults,
  };
}

export function VariantEditor({
  productSlug,
  variants,
  onChange,
  standardMeasurements,
}: {
  productSlug: string;
  variants: VariantDraft[];
  onChange: (variants: VariantDraft[]) => void;
  standardMeasurements: StandardMeasurements;
}) {
  const [genColor, setGenColor] = useState("");
  const [genHex, setGenHex] = useState("#0A0A0A");
  const [activePreset, setActivePreset] = useState<keyof typeof SIZE_PRESETS | null>(null);
  const [genSizes, setGenSizes] = useState<string[]>([]);
  const [genStock, setGenStock] = useState(0);
  const [bulkStockValue, setBulkStockValue] = useState(0);

  const groups = useMemo(() => {
    const map = new Map<string, VariantDraft[]>();
    for (const v of variants) {
      const key = v.color;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    }
    return Array.from(map.entries());
  }, [variants]);

  function siblingSkuSet(clientId: string, rows: VariantDraft[] = variants): Set<string> {
    return new Set(rows.filter((r) => r.clientId !== clientId).map((r) => r.sku));
  }

  function updateRow(clientId: string, patch: Partial<VariantDraft>) {
    const next = variants.map((v) => {
      if (v.clientId !== clientId) return v;
      const merged = { ...v, ...patch };
      if ("sku" in patch) {
        // operator is typing the SKU directly
        return { ...merged, skuManual: patch.sku !== "" };
      }
      if (("color" in patch || "size" in patch) && !merged.skuManual) {
        return { ...merged, sku: autoSku(merged, productSlug, siblingSkuSet(clientId)) };
      }
      return merged;
    });
    onChange(next);
  }

  function handleSkuBlur(clientId: string) {
    const row = variants.find((v) => v.clientId === clientId);
    if (row && row.skuManual && row.sku.trim() === "") {
      // Never leave it empty — fall back to the auto value instead.
      updateRow(clientId, { sku: autoSku(row, productSlug, siblingSkuSet(clientId)), skuManual: false });
    }
  }

  function removeRow(clientId: string) {
    onChange(variants.filter((v) => v.clientId !== clientId));
  }

  function removeColorGroup(color: string) {
    onChange(variants.filter((v) => v.color !== color));
  }

  function addBlankRow() {
    onChange([...variants, makeEmptyVariant(standardMeasurements)]);
  }

  function applyBulkStock() {
    onChange(variants.map((v) => ({ ...v, stock: bulkStockValue })));
  }

  function togglePreset(key: keyof typeof SIZE_PRESETS) {
    setActivePreset(key);
    setGenSizes([...SIZE_PRESETS[key].sizes]);
  }

  function toggleSize(size: string) {
    setGenSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size],
    );
  }

  function generateVariants() {
    if (!genColor.trim() || genSizes.length === 0) return;

    const existingKey = (color: string, size: string) =>
      `${color.trim().toLowerCase()}::${size.trim().toLowerCase()}`;
    const existing = new Set(variants.map((v) => existingKey(v.color, v.size)));

    const created: VariantDraft[] = [];
    for (const size of genSizes) {
      const key = existingKey(genColor, size);
      if (existing.has(key)) continue;
      existing.add(key);
      const clientId = newClientId();
      const taken = siblingSkuSet("", [...variants, ...created]);
      created.push({
        clientId,
        color: genColor.trim(),
        color_hex: genHex,
        size,
        sku: autoSku({ clientId, color: genColor, size }, productSlug, taken),
        skuManual: false,
        stock: genStock,
        ...standardMeasurements,
      });
    }

    if (created.length > 0) onChange([...variants, ...created]);

    setGenColor("");
    setActivePreset(null);
    setGenSizes([]);
  }

  return (
    <div id="field-variants" className="scroll-mt-24">
      <p className="text-label mb-3">Gerar variações</p>
      <div className="mb-8 flex flex-col gap-4 border border-dashed border-line p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_auto]">
          <div className="flex flex-col gap-2">
            <Label htmlFor="gen-color">Cor</Label>
            <Input
              id="gen-color"
              value={genColor}
              onChange={(e) => setGenColor(e.target.value)}
              placeholder="Ex: Branco"
              className="rounded-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gen-hex">Hex</Label>
            <div className="flex items-center gap-2">
              <input
                id="gen-hex-picker"
                type="color"
                value={genHex}
                onChange={(e) => setGenHex(e.target.value)}
                className="size-9 shrink-0 border border-line bg-transparent"
                aria-label="Selecionar cor"
              />
              <Input
                id="gen-hex"
                value={genHex}
                onChange={(e) => setGenHex(e.target.value)}
                className="w-28 rounded-none"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gen-stock">Estoque inicial</Label>
            <Input
              id="gen-stock"
              type="number"
              min={0}
              value={genStock}
              onChange={(e) => setGenStock(Number(e.target.value) || 0)}
              className="w-28 rounded-none"
            />
          </div>
        </div>

        <div>
          <p className="text-label mb-2">Tamanhos</p>
          <div className="mb-2 flex flex-wrap gap-2">
            {(Object.keys(SIZE_PRESETS) as (keyof typeof SIZE_PRESETS)[]).map((key) => (
              <Button
                key={key}
                type="button"
                variant={activePreset === key ? "default" : "outline"}
                size="sm"
                onClick={() => togglePreset(key)}
              >
                {SIZE_PRESETS[key].label}
              </Button>
            ))}
          </div>
          {activePreset && (
            <div className="flex flex-wrap gap-2">
              {SIZE_PRESETS[activePreset].sizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => toggleSize(size)}
                  aria-pressed={genSizes.includes(size)}
                  className={`h-8 min-w-9 border px-2 text-xs uppercase transition-colors duration-150 ease-out ${
                    genSizes.includes(size)
                      ? "border-fg bg-fg text-bg"
                      : "border-line text-ink-muted hover:border-ink-muted"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          type="button"
          onClick={generateVariants}
          disabled={!genColor.trim() || genSizes.length === 0}
          className="w-fit"
        >
          <Wand2 className="size-4" /> Gerar variações
        </Button>
        <p className="text-xs text-ink-muted">
          Combinações já existentes (mesma cor e tamanho) são ignoradas. Use
          quantas vezes precisar para outras cores.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <p className="text-label">Variações cadastradas</p>
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="bulk-stock" className="text-[10px]">
              Aplicar estoque a todas
            </Label>
            <Input
              id="bulk-stock"
              type="number"
              min={0}
              value={bulkStockValue}
              onChange={(e) => setBulkStockValue(Number(e.target.value) || 0)}
              className="w-24 rounded-none"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={applyBulkStock}
            disabled={variants.length === 0}
          >
            Aplicar
          </Button>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="border border-dashed border-line p-6 text-center text-sm text-ink-muted">
          Nenhuma variação ainda. Use o gerador acima ou adicione uma linha manualmente.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(([color, rows]) => (
            <div
              key={color}
              className={`border ${!color ? "border-[var(--danger)]" : "border-line"}`}
            >
              <div className="flex items-center justify-between border-b border-line bg-[#111111] px-4 py-2">
                <div className="flex items-center gap-2">
                  <span
                    className="size-4 rounded-full border border-line"
                    style={{ backgroundColor: rows[0]?.color_hex || "#8A8A8A" }}
                  />
                  <span className={`text-sm ${!color ? "text-[var(--danger)]" : ""}`}>
                    {color || "Cor obrigatória — defina abaixo"}
                  </span>
                  <span className="text-xs text-ink-muted">
                    ({rows.length} {rows.length === 1 ? "tamanho" : "tamanhos"})
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeColorGroup(color)}
                  className="text-[var(--danger)] hover:text-[var(--danger)]"
                >
                  <X className="size-3.5" /> Remover cor
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-label">
                      <th className="p-3 text-left">Tamanho</th>
                      <th className="p-3 text-left">SKU</th>
                      <th className="p-3 text-left">Estoque</th>
                      <th className="p-3 text-left">Peso (g)</th>
                      <th className="p-3 text-left">C (cm)</th>
                      <th className="p-3 text-left">L (cm)</th>
                      <th className="p-3 text-left">A (cm)</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((variant) => (
                      <tr key={variant.clientId} className="border-b border-line/50 last:border-0">
                        <td className="p-2">
                          <Input
                            value={variant.size}
                            onChange={(e) => updateRow(variant.clientId, { size: e.target.value })}
                            placeholder="M"
                            aria-label="Tamanho"
                            required
                            className={`w-20 rounded-none ${
                              !variant.size.trim() ? "border-[var(--danger)]" : ""
                            }`}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={variant.sku}
                            onChange={(e) => updateRow(variant.clientId, { sku: e.target.value })}
                            onBlur={() => handleSkuBlur(variant.clientId)}
                            aria-label="SKU"
                            className="w-44 rounded-none"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={0}
                            value={variant.stock}
                            onChange={(e) =>
                              updateRow(variant.clientId, { stock: Number(e.target.value) || 0 })
                            }
                            aria-label="Estoque"
                            className="w-20 rounded-none"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={0}
                            value={variant.weight_grams ?? ""}
                            onChange={(e) =>
                              updateRow(variant.clientId, {
                                weight_grams: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                            aria-label="Peso em gramas"
                            className="w-24 rounded-none"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.1"
                            value={variant.length_cm ?? ""}
                            onChange={(e) =>
                              updateRow(variant.clientId, {
                                length_cm: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                            aria-label="Comprimento em centímetros"
                            className="w-20 rounded-none"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.1"
                            value={variant.width_cm ?? ""}
                            onChange={(e) =>
                              updateRow(variant.clientId, {
                                width_cm: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                            aria-label="Largura em centímetros"
                            className="w-20 rounded-none"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.1"
                            value={variant.height_cm ?? ""}
                            onChange={(e) =>
                              updateRow(variant.clientId, {
                                height_cm: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                            aria-label="Altura em centímetros"
                            className="w-20 rounded-none"
                          />
                        </td>
                        <td className="p-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeRow(variant.clientId)}
                            aria-label="Remover variação"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Cor / hex editable at the group level too, for quick fixes */}
              <div className="flex flex-wrap items-center gap-4 border-t border-line px-4 py-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`color-${color}`} className="text-[10px]">
                    Nome da cor
                  </Label>
                  <Input
                    id={`color-${color}`}
                    defaultValue={color}
                    placeholder="Nome da cor"
                    required
                    className={`h-8 w-40 rounded-none ${!color ? "border-[var(--danger)]" : ""}`}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (!value || value === color) return;
                      onChange(
                        variants.map((v) =>
                          v.color === color
                            ? {
                                ...v,
                                color: value,
                                sku: v.skuManual
                                  ? v.sku
                                  : autoSku({ ...v, color: value }, productSlug, siblingSkuSet(v.clientId)),
                              }
                            : v,
                        ),
                      );
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`hex-${color}`} className="text-[10px]">
                    Cor (hex)
                  </Label>
                  <input
                    id={`hex-${color}`}
                    type="color"
                    value={rows[0]?.color_hex || "#000000"}
                    onChange={(e) => {
                      const value = e.target.value;
                      onChange(
                        variants.map((v) => (v.color === color ? { ...v, color_hex: value } : v)),
                      );
                    }}
                    className="size-8 shrink-0 border border-line bg-transparent"
                    aria-label={`Cor (hex) de ${color}`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" className="mt-4" onClick={addBlankRow}>
        <Plus className="size-4" /> Adicionar variação em branco
      </Button>
    </div>
  );
}
