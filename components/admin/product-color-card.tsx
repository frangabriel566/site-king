"use client";

import { useId, useState, type RefObject } from "react";
import { Trash2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/admin/image-uploader";
import { selectOnFocus } from "@/lib/utils";
import type { ColorDraft } from "@/lib/variants";

export function ProductColorCard({
  color,
  sizeOptions,
  onChange,
  onRemove,
  checkDuplicate,
  savingRef,
  colorless = false,
}: {
  color: ColorDraft;
  /** Letter or numeric run, picked by the category upstream. Sizes this
   * color already uses are always shown too, even when they belong to the
   * other run (a saved product can mix them). */
  sizeOptions: string[];
  onChange: (patch: Partial<ColorDraft>) => void;
  onRemove?: () => void;
  checkDuplicate?: (file: File, slotId: string, label: string) => Promise<string | undefined>;
  /** Flipped by the form right before a real save — see ImageUploader. */
  savingRef: RefObject<boolean>;
  /** "Só tamanhos" mode: the product has a single colourway, so the colour
   * header (photo, name, swatch, remove) is dropped and only the size and
   * stock controls remain. Everything below is identical — the sizes of one
   * colourway work exactly like the sizes of a named colour. */
  colorless?: boolean;
}) {
  // Ids for the DOM come from useId, never from color.id: React guarantees
  // useId agrees across the server render and hydration, which keeps these
  // attributes correct no matter where the draft's own identity came from.
  const fieldId = useId();
  const [customSize, setCustomSize] = useState("");
  // A brand-new card starts out empty on purpose — flagging it red before
  // the operator has even reached it would be noise, so the missing-name
  // state only shows after they've left the field.
  const [nameTouched, setNameTouched] = useState(color.name.trim() !== "");

  const selected = color.sizes.map((s) => s.size);
  const options = [...sizeOptions, ...selected.filter((s) => !sizeOptions.includes(s))];
  const allSelected = sizeOptions.every((size) => selected.includes(size));
  const label = colorless ? "este produto" : color.name.trim() || "nova cor";

  /** Keeps the row reading P, M, G… (or 38, 39, 40…) no matter what order
   * they were clicked in; anything off-list sorts to the end. */
  function sortSizes(sizes: typeof color.sizes) {
    const rank = (size: string) => {
      const index = options.indexOf(size);
      return index === -1 ? options.length : index;
    };
    return [...sizes].sort((a, b) => rank(a.size) - rank(b.size));
  }

  function toggleSize(size: string) {
    const exists = color.sizes.some((s) => s.size === size);
    onChange({
      sizes: exists
        ? color.sizes.filter((s) => s.size !== size)
        : sortSizes([...color.sizes, { size, stock: 0, sku: "", skuManual: false }]),
    });
  }

  /** Marks the whole run at once (P–XG, or 34–44 for calçados) — the usual
   * case for a piece that comes in every size. Clicking again clears the
   * run but keeps sizes typed by hand in "Outro", which aren't part of it.
   * Sizes already selected keep the stock they had. */
  function toggleAllSizes() {
    if (allSelected) {
      onChange({ sizes: color.sizes.filter((s) => !sizeOptions.includes(s.size)) });
      return;
    }
    const missing = sizeOptions.filter((size) => !selected.includes(size));
    onChange({
      sizes: sortSizes([
        ...color.sizes,
        ...missing.map((size) => ({ size, stock: 0, sku: "", skuManual: false })),
      ]),
    });
  }

  function setStock(size: string, stock: number) {
    onChange({ sizes: color.sizes.map((s) => (s.size === size ? { ...s, stock } : s)) });
  }

  function addCustomSize() {
    const value = customSize.trim().toUpperCase();
    setCustomSize("");
    if (!value || selected.includes(value)) return;
    onChange({
      sizes: sortSizes([...color.sizes, { size: value, stock: 0, sku: "", skuManual: false }]),
    });
  }

  return (
    <div className="rounded-lg border border-line bg-surface-2 p-4">
      {!colorless && (
      <div className="flex flex-wrap items-start gap-4">
        <div className="w-24 shrink-0">
          <ImageUploader
            label="Foto da cor"
            value={color.imageUrl || null}
            onChange={(url) => onChange({ imageUrl: url ?? "" })}
            folder="products"
            aspect="aspect-square"
            savingRef={savingRef}
            checkDuplicate={
              checkDuplicate
                ? (file) => checkDuplicate(file, `color-photo-${color.id}`, `Foto da cor "${label}"`)
                : undefined
            }
          />
        </div>

        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <Label htmlFor={`${fieldId}-name`}>
            Nome da cor <span className="text-accent-light">*</span>
          </Label>
          <div className="flex items-center gap-2">
            <input
              id={`${fieldId}-hex`}
              type="color"
              value={color.hex}
              onChange={(e) => onChange({ hex: e.target.value })}
              className="size-10 shrink-0 cursor-pointer rounded-lg border border-line bg-transparent"
              aria-label={`Cor da amostra de ${label}`}
            />
            <Input
              id={`${fieldId}-name`}
              value={color.name}
              onChange={(e) => onChange({ name: e.target.value })}
              onBlur={() => setNameTouched(true)}
              placeholder="Ex: Preto"
              aria-invalid={nameTouched && color.name.trim() === ""}
              className="h-10"
            />
          </div>
          <p className="text-xs text-ink-muted">
            A amostra à esquerda é a cor que aparece na loja quando esta cor não tem foto.
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={`Remover a cor ${label}`}
          className="text-[var(--danger)] hover:text-[var(--danger)]"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      )}

      <div className={colorless ? "" : "mt-5"}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-label">Tamanhos disponíveis</p>
          <button
            type="button"
            onClick={toggleAllSizes}
            aria-pressed={allSelected}
            className="text-xs text-ink-muted underline underline-offset-4 transition-colors duration-150 ease-out hover:text-accent-light"
          >
            {allSelected
              ? "Limpar todos"
              : `Marcar todos (${sizeOptions[0]}–${sizeOptions[sizeOptions.length - 1]})`}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {options.map((size) => {
            const isActive = selected.includes(size);
            return (
              <button
                key={size}
                type="button"
                onClick={() => toggleSize(size)}
                aria-pressed={isActive}
                className={`flex h-10 min-w-11 items-center justify-center rounded-lg border px-2.5 text-sm font-medium uppercase transition-colors duration-150 ease-out ${
                  isActive
                    ? "border-accent-solid bg-accent-solid text-white"
                    : "border-line text-ink-muted hover:border-ink-muted hover:text-fg"
                }`}
              >
                {size}
              </button>
            );
          })}

          <div className="flex items-center gap-1">
            <Input
              value={customSize}
              onChange={(e) => setCustomSize(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomSize();
                }
              }}
              placeholder="Outro"
              aria-label={`Adicionar outro tamanho para ${label}`}
              className="h-10 w-20"
            />
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={addCustomSize}
              disabled={customSize.trim() === ""}
              aria-label="Adicionar tamanho"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {color.sizes.length > 0 && (
        <div className="mt-5">
          <p className="text-label mb-2">Estoque por tamanho</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {color.sizes.map((size) => (
              <div key={size.size} className="flex flex-col gap-1.5">
                <Label
                  htmlFor={`${fieldId}-stock-${size.size}`}
                  className="text-xs uppercase text-ink-muted"
                >
                  {size.size}
                </Label>
                <Input
                  id={`${fieldId}-stock-${size.size}`}
                  type="number"
                  min={0}
                  value={size.stock}
                  onChange={(e) => setStock(size.size, Number(e.target.value) || 0)}
                  onFocus={selectOnFocus}
                  className="h-10"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-ink-muted">
        {color.sizes.length === 0
          ? `Selecione os tamanhos para gerar as variações ${
              colorless ? "deste produto" : "desta cor"
            }.`
          : `Variações geradas automaticamente (${color.sizes.length} ${
              color.sizes.length === 1 ? "variação" : "variações"
            })`}
      </p>
    </div>
  );
}
