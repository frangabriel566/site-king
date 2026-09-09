"use client";

import { useEffect, useMemo, useState, type FocusEvent } from "react";
import { Plus, Trash2, Wand2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ImageUploader } from "@/components/admin/image-uploader";
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
  image_url: string;
};

export const LETTER_SIZES = ["P", "M", "G", "GG", "XG"];
export const NUMERIC_SIZES = ["34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44"];

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

/** Selects the field's full text on focus so typing a new number always
 * replaces it — without this, a plain number input inserts at the cursor,
 * so retyping over a stale value silently produces garbage (e.g. typing
 * "8" into a field still showing "10" can yield "108" or "1080", not 8). */
function selectOnFocus(e: FocusEvent<HTMLInputElement>) {
  e.target.select();
}

function autoSku(
  row: Pick<VariantDraft, "clientId" | "color" | "size">,
  productSlug: string,
  siblingSkus: Set<string>,
): string {
  const base = buildSkuBase(productSlug, row.color, row.size);
  return withUniqueSuffix(base, row.clientId, siblingSkus);
}

export function makeEmptyVariant(): VariantDraft {
  return {
    clientId: newClientId(),
    color: "",
    color_hex: "",
    size: "",
    sku: "",
    skuManual: false,
    stock: 0,
    image_url: "",
  };
}

export function VariantEditor({
  productSlug,
  variants,
  onChange,
  isShoeCategory = false,
  existingSkus = [],
  checkDuplicate,
}: {
  productSlug: string;
  variants: VariantDraft[];
  onChange: (variants: VariantDraft[]) => void;
  /** Category (Tênis, Chinelos e sandálias) already tells us this is
   * shoe sizing — default the generator to BR numbering instead of
   * making the operator toggle it by hand every time. */
  isShoeCategory?: boolean;
  /** SKUs already saved on OTHER products — sku is unique across the
   * whole table, not per-product, so the generator needs to dodge these
   * too, not just the rows already on screen. */
  existingSkus?: string[];
  /** Cross-field duplicate check shared with the product's general
   * gallery — catches uploading the exact same photo both as a color's
   * own photo and as a general product image. Raw registry function
   * (not pre-bound to a slot) since the color-photo slot is generated
   * dynamically from `genColor`, which only this component knows. */
  checkDuplicate?: (file: File, slotId: string, label: string) => Promise<string | undefined>;
}) {
  const [genColor, setGenColor] = useState("");
  const [genHex, setGenHex] = useState("#0A0A0A");
  const [genImageUrl, setGenImageUrl] = useState<string | null>(null);
  const [sizeMode, setSizeMode] = useState<"letter" | "numeric">(
    isShoeCategory ? "numeric" : "letter",
  );
  const [genSizes, setGenSizes] = useState<string[]>([]);
  const [genStock, setGenStock] = useState(0);
  const [bulkStockValue, setBulkStockValue] = useState(0);

  // Auto-follow the category — still overridable by hand via the toggle
  // below, but only re-synced when the category itself changes so a
  // manual override isn't clobbered on every unrelated re-render.
  useEffect(() => {
    setSizeMode(isShoeCategory ? "numeric" : "letter");
    setGenSizes([]);
  }, [isShoeCategory]);

  const sizeOptions = sizeMode === "letter" ? LETTER_SIZES : NUMERIC_SIZES;

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
    const taken = rows.filter((r) => r.clientId !== clientId).map((r) => r.sku);
    return new Set([...existingSkus, ...taken]);
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

  function setColorPhoto(color: string, url: string) {
    onChange(variants.map((v) => (v.color === color ? { ...v, image_url: url } : v)));
  }

  function addBlankRow() {
    onChange([...variants, makeEmptyVariant()]);
  }

  function applyBulkStock() {
    onChange(variants.map((v) => ({ ...v, stock: bulkStockValue })));
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
        image_url: genImageUrl ?? "",
      });
    }

    if (created.length > 0) onChange([...variants, ...created]);

    setGenColor("");
    setGenImageUrl(null);
    setGenSizes([]);
    setGenStock(0);
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 border border-dashed border-line p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_auto]">
          <div className="flex flex-col gap-2">
            <Label htmlFor="gen-color">Nome da cor</Label>
            <Input
              id="gen-color"
              value={genColor}
              onChange={(e) => setGenColor(e.target.value)}
              placeholder="Ex: Branco"
              className="rounded-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gen-hex">Código hex</Label>
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
              onFocus={selectOnFocus}
              className="w-28 rounded-none"
            />
          </div>
        </div>

        <div className="max-w-40">
          <ImageUploader
            label="Foto desta cor (opcional)"
            value={genImageUrl}
            onChange={setGenImageUrl}
            folder="products"
            aspect="aspect-square"
            checkDuplicate={
              checkDuplicate
                ? (file) =>
                    checkDuplicate(
                      file,
                      "generator-color-photo",
                      `Foto da cor "${genColor.trim() || "sem nome"}"`,
                    )
                : undefined
            }
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-label">Tamanhos disponíveis</p>
            <button
              type="button"
              onClick={() => {
                setSizeMode((m) => (m === "letter" ? "numeric" : "letter"));
                setGenSizes([]);
              }}
              className="text-xs text-ink-muted underline underline-offset-4 hover:text-fg"
            >
              {sizeMode === "letter" ? "Usar numeração (calçados)" : "Usar letras (P–XG)"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {sizeOptions.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => toggleSize(size)}
                aria-pressed={genSizes.includes(size)}
                className={`flex h-10 min-w-10 items-center justify-center border px-2 text-sm font-medium uppercase transition-colors duration-150 ease-out ${
                  genSizes.includes(size)
                    ? "border-fg bg-fg text-bg"
                    : "border-line text-ink-muted hover:border-ink-muted"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
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
        <p className="text-label">Estoque por variação</p>
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
              onFocus={selectOnFocus}
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
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-[#111111] px-4 py-2">
                <div className="flex items-center gap-3">
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
                <table className="w-full min-w-[480px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-label">
                      <th className="p-3 text-left">Tamanho</th>
                      <th className="p-3 text-left">SKU</th>
                      <th className="p-3 text-left">Estoque</th>
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
                            title={
                              existingSkus.includes(variant.sku)
                                ? "Esse SKU já está em uso por outro produto"
                                : undefined
                            }
                            className={`w-44 rounded-none ${
                              existingSkus.includes(variant.sku) ? "border-[var(--danger)]" : ""
                            }`}
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
                            onFocus={selectOnFocus}
                            aria-label="Estoque"
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
              {/* Cor / hex / foto editáveis no nível do grupo, para ajustes rápidos */}
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
                <div className="w-28">
                  <ImageUploader
                    label="Foto da cor"
                    value={rows[0]?.image_url || null}
                    onChange={(url) => setColorPhoto(color, url ?? "")}
                    folder="products"
                    aspect="aspect-square"
                    checkDuplicate={
                      checkDuplicate
                        ? (file) => checkDuplicate(file, `color-photo-${color}`, `Foto da cor "${color}"`)
                        : undefined
                    }
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
