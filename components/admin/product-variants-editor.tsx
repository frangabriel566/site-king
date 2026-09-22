"use client";

import { useEffect, useState, type RefObject } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ProductColorCard } from "@/components/admin/product-color-card";
import { selectOnFocus } from "@/lib/utils";
import {
  LETTER_SIZES,
  NUMERIC_SIZES,
  countVariants,
  makeEmptyColor,
  type ColorDraft,
  type VariantMode,
} from "@/lib/variants";

const MODES: { value: VariantMode; title: string; description: string }[] = [
  {
    value: "colors",
    title: "Cores e tamanhos",
    description: "Mais de uma cor, cada uma com seus tamanhos.",
  },
  {
    value: "sizes",
    title: "Só tamanhos",
    description: "Uma cor só. O cliente escolhe o tamanho.",
  },
  {
    value: "single",
    title: "Peça única",
    description: "Sem escolha. Um estoque só.",
  },
];

export function ProductVariantsEditor({
  mode,
  onModeChange,
  colors,
  onColorsChange,
  sizeOnly,
  onSizeOnlyChange,
  simpleStock,
  onSimpleStockChange,
  simpleSize,
  onSimpleSizeChange,
  isShoeCategory,
  savingRef,
  checkDuplicate,
}: {
  mode: VariantMode;
  onModeChange: (mode: VariantMode) => void;
  colors: ColorDraft[];
  onColorsChange: (colors: ColorDraft[]) => void;
  /** The single, unnamed colourway behind "só tamanhos". Kept apart from
   * `colors` so switching modes back and forth never throws away either
   * one's work. */
  sizeOnly: ColorDraft;
  onSizeOnlyChange: (color: ColorDraft) => void;
  /** Peça única: a single stock figure, no size picker for the shopper. */
  simpleStock: number;
  onSimpleStockChange: (value: number) => void;
  /** Informational only — stored as a "Tamanho" spec row, not as a
   * pickable variant size (see ProductForm). */
  simpleSize: string;
  onSimpleSizeChange: (size: string) => void;
  isShoeCategory: boolean;
  /** Flipped by the form right before a real save — see ImageUploader. */
  savingRef: RefObject<boolean>;
  checkDuplicate?: (file: File, slotId: string, label: string) => Promise<string | undefined>;
}) {
  const [sizeMode, setSizeMode] = useState<"letter" | "numeric">(
    isShoeCategory ? "numeric" : "letter",
  );
  const [bulkStock, setBulkStock] = useState(0);

  // Follows the category, still overridable by hand below — re-synced only
  // when the category itself changes, so a manual override survives
  // unrelated re-renders.
  useEffect(() => {
    setSizeMode(isShoeCategory ? "numeric" : "letter");
  }, [isShoeCategory]);

  const sizeOptions = sizeMode === "letter" ? LETTER_SIZES : NUMERIC_SIZES;
  const totals = countVariants(colors);

  // A size with no stock renders struck through and disabled on the product
  // page, so a product whose every size sits at zero looks published but
  // can't be bought — and stock starts at zero the moment a size is marked.
  const stockedSizes = (mode === "sizes" ? [sizeOnly] : colors).flatMap((color) => color.sizes);
  const noStockAnywhere =
    mode === "single"
      ? simpleStock <= 0
      : stockedSizes.length > 0 && stockedSizes.every((size) => size.stock <= 0);

  function updateColor(id: string, patch: Partial<ColorDraft>) {
    onColorsChange(colors.map((color) => (color.id === id ? { ...color, ...patch } : color)));
  }

  function applyBulkStock() {
    onColorsChange(
      colors.map((color) => ({
        ...color,
        sizes: color.sizes.map((size) => ({ ...size, stock: bulkStock })),
      })),
    );
  }

  const sizeModeToggle = (
    <button
      type="button"
      onClick={() => setSizeMode((current) => (current === "letter" ? "numeric" : "letter"))}
      className="text-xs text-ink-muted underline underline-offset-4 hover:text-fg"
    >
      {sizeMode === "letter" ? "Usar numeração (calçados)" : "Usar letras (P–XG)"}
    </button>
  );

  return (
    <>
      <div>
        <p className="text-label mb-2">Como este produto é vendido?</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map((option) => {
            const isActive = mode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onModeChange(option.value)}
                aria-pressed={isActive}
                className={`rounded-lg border p-3 text-left transition-colors duration-150 ease-out ${
                  isActive
                    ? "border-[color-mix(in_srgb,var(--accent-hover)_40%,transparent)] bg-accent-soft"
                    : "border-line hover:border-ink-muted"
                }`}
              >
                <span
                  className={`block text-sm font-medium ${
                    isActive ? "text-fg" : "text-ink-muted"
                  }`}
                >
                  {option.title}
                </span>
                <span className="mt-1 block text-xs text-ink-muted">{option.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {noStockAnywhere && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-3 text-xs text-[var(--warning)]"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {mode === "single"
              ? "Estoque zerado — o produto aparece esgotado e o cliente não consegue comprar."
              : "Nenhum tamanho tem estoque — todos aparecem riscados na loja e o cliente não consegue comprar. Preencha o estoque de cada tamanho."}
          </span>
        </p>
      )}

      {mode === "single" && (
        <div className="rounded-lg border border-line bg-surface-2 p-4">
          <div className="flex flex-col gap-2 sm:max-w-40">
            <Label htmlFor="simple-stock">Estoque</Label>
            <Input
              id="simple-stock"
              type="number"
              min={0}
              value={simpleStock}
              onChange={(e) => onSimpleStockChange(Number(e.target.value) || 0)}
              onFocus={selectOnFocus}
              className="h-10"
            />
          </div>

          <div className="mt-5">
            <p className="text-label mb-2">Tamanho (opcional)</p>
            <div className="flex flex-wrap gap-2">
              {sizeOptions.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => onSimpleSizeChange(size)}
                  aria-pressed={simpleSize === size}
                  className={`flex h-10 min-w-11 items-center justify-center rounded-lg border px-2.5 text-sm font-medium uppercase transition-colors duration-150 ease-out ${
                    simpleSize === size
                      ? "border-accent-solid bg-accent-solid text-white"
                      : "border-line text-ink-muted hover:border-ink-muted hover:text-fg"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              Só pra exibir na ficha técnica: como é peça única, o cliente não escolhe o
              tamanho e o estoque acima vale pela peça toda. Se essa peça sai em vários
              tamanhos, use &quot;Só tamanhos&quot; acima.
            </p>
          </div>
        </div>
      )}

      {mode === "sizes" && (
        <>
          <div className="flex justify-end">{sizeModeToggle}</div>
          <ProductColorCard
            colorless
            color={sizeOnly}
            sizeOptions={sizeOptions}
            savingRef={savingRef}
            onChange={(patch) => onSizeOnlyChange({ ...sizeOnly, ...patch })}
          />
          <p className="text-xs text-ink-muted">
            Cada tamanho marcado vira uma opção na página do produto, com o estoque que você
            definir aqui. As fotos são as da etapa 2.
          </p>
        </>
      )}

      {mode === "colors" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {sizeModeToggle}

            {totals.variants > 1 && (
              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="bulk-stock" className="text-[10px]">
                    Aplicar estoque a todas
                  </Label>
                  <Input
                    id="bulk-stock"
                    type="number"
                    min={0}
                    value={bulkStock}
                    onChange={(e) => setBulkStock(Number(e.target.value) || 0)}
                    onFocus={selectOnFocus}
                    className="h-9 w-24"
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={applyBulkStock}>
                  Aplicar
                </Button>
              </div>
            )}
          </div>

          {colors.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink-muted">
              Nenhuma cor ainda. Adicione a primeira cor para gerar as variações.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {colors.map((color) => (
                <ProductColorCard
                  key={color.id}
                  color={color}
                  sizeOptions={sizeOptions}
                  onChange={(patch) => updateColor(color.id, patch)}
                  onRemove={() => onColorsChange(colors.filter((c) => c.id !== color.id))}
                  savingRef={savingRef}
                  checkDuplicate={checkDuplicate}
                />
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onColorsChange([...colors, makeEmptyColor()])}
            >
              <Plus className="size-4" /> Adicionar outra cor
            </Button>
            {totals.variants > 0 && (
              <p className="text-xs text-ink-muted">
                {totals.colors} {totals.colors === 1 ? "cor" : "cores"} · {totals.sizes}{" "}
                {totals.sizes === 1 ? "tamanho" : "tamanhos"} · {totals.variants}{" "}
                {totals.variants === 1 ? "variação" : "variações"}
              </p>
            )}
          </div>
        </>
      )}
    </>
  );
}
