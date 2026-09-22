"use client";

import { useId, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ChevronDown, Plus, Settings, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InlineBrandCreator } from "@/components/admin/inline-brand-creator";
import { AttributesEditor, type AttributeRow } from "@/components/admin/attributes-editor";
import { selectOnFocus } from "@/lib/utils";
import { isColorlessVariant } from "@/lib/constants";
import type { VariantDraft } from "@/lib/variants";
import type { AdminBrandListItem } from "@/lib/data/brands";
import type { ProductStatus } from "@/lib/database.types";

const NEW_BRAND_VALUE = "__new_brand__";
const NO_BRAND_VALUE = "__no_brand__";

export function ProductAdvancedSettings({
  open,
  onOpenChange,
  description,
  onDescriptionChange,
  videoUrl,
  onVideoUrlChange,
  brands,
  brandId,
  onBrandChange,
  onBrandCreated,
  manufacturerRef,
  onManufacturerRefChange,
  tags,
  onTagsChange,
  attributeRows,
  onAttributeRowsChange,
  status,
  onStatusChange,
  position,
  onPositionChange,
  shippingNote,
  onShippingNoteChange,
  exchangeInfo,
  onExchangeInfoChange,
  careInstructions,
  onCareInstructionsChange,
  singlePiece,
  simpleSku,
  onSimpleSkuChange,
  variants,
  onVariantSkuChange,
  existingSkus,
  invalidAnchors,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  videoUrl: string;
  onVideoUrlChange: (value: string) => void;
  brands: Pick<AdminBrandListItem, "id" | "name">[];
  brandId: string;
  onBrandChange: (value: string) => void;
  onBrandCreated: (brand: Pick<AdminBrandListItem, "id" | "name">) => void;
  manufacturerRef: string;
  onManufacturerRefChange: (value: string) => void;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  attributeRows: AttributeRow[];
  onAttributeRowsChange: (rows: AttributeRow[]) => void;
  status: ProductStatus;
  onStatusChange: (status: ProductStatus) => void;
  position: string;
  onPositionChange: (value: string) => void;
  shippingNote: string;
  onShippingNoteChange: (value: string) => void;
  exchangeInfo: string;
  onExchangeInfoChange: (value: string) => void;
  careInstructions: string;
  onCareInstructionsChange: (value: string) => void;
  /** Peça única: one SKU for the whole product instead of a list. */
  singlePiece: boolean;
  simpleSku: string;
  onSimpleSkuChange: (value: string) => void;
  /** Already derived from the color cards — this panel only overrides the
   * generated SKU, it never creates or removes a variation. */
  variants: VariantDraft[];
  onVariantSkuChange: (clientId: string, sku: string) => void;
  existingSkus: string[];
  invalidAnchors: Set<string>;
}) {
  const contentId = useId();
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");

  function addTag(raw: string) {
    const value = raw.trim();
    if (!value || tags.includes(value)) return;
    onTagsChange([...tags, value]);
  }

  function handleTagKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
      setTagInput("");
    } else if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
      onTagsChange(tags.slice(0, -1));
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center gap-3 rounded-xl p-4 text-left md:p-6"
      >
        <Settings className="size-5 shrink-0 text-ink-muted" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-fg">Configurações avançadas</span>
          <span className="mt-1 block text-xs text-ink-muted">
            Vídeo, ficha técnica, marca, tags, envio, troca e cuidados.
          </span>
        </span>
        <ChevronDown
          className={`size-5 shrink-0 text-ink-muted transition-transform duration-200 ease-out ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Never unmounted, only hidden: these are real form fields, and a
          field that isn't in the DOM isn't in the FormData either — closing
          the panel would blank out description, status and the rest on the
          next save. */}
      <div
        id={contentId}
        className={`flex flex-col gap-6 border-t border-line p-4 md:p-6 ${open ? "" : "hidden"}`}
      >
        <div id="field-description" className="flex scroll-mt-24 flex-col gap-2">
          <Label htmlFor="description">Descrição completa</Label>
          <Textarea
            id="description"
            name="description"
            rows={5}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Detalhes, materiais, caimento…"
            aria-invalid={invalidAnchors.has("field-description")}
          />
          <p className="text-xs text-ink-muted">
            Precisa de pelo menos 30 caracteres para publicar o produto.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="video_url">Vídeo do produto</Label>
            <Input
              id="video_url"
              name="video_url"
              type="url"
              value={videoUrl}
              onChange={(e) => onVideoUrlChange(e.target.value)}
              placeholder="Link do YouTube, Vimeo ou arquivo .mp4"
              className="h-10"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="brand_id">Marca</Label>
            <Select
              value={brandId || NO_BRAND_VALUE}
              onValueChange={(value) => {
                if (value === NEW_BRAND_VALUE) {
                  setBrandDialogOpen(true);
                  return;
                }
                onBrandChange(value === NO_BRAND_VALUE ? "" : value);
              }}
            >
              <SelectTrigger id="brand_id" className="w-full data-[size=default]:h-10">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_BRAND_VALUE}>Sem marca</SelectItem>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_BRAND_VALUE} className="!text-accent-light">
                  <Plus className="size-3.5" /> Criar nova marca
                </SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="brand_id" value={brandId} />
            <InlineBrandCreator
              open={brandDialogOpen}
              onOpenChange={setBrandDialogOpen}
              onCreated={(brand) => {
                onBrandCreated(brand);
                onBrandChange(brand.id);
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="manufacturer_ref">Referência do fabricante</Label>
            <Input
              id="manufacturer_ref"
              name="manufacturer_ref"
              value={manufacturerRef}
              onChange={(e) => onManufacturerRefChange(e.target.value)}
              className="h-10"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="status">Situação do produto</Label>
            <Select
              name="status"
              value={status}
              onValueChange={(value) => onStatusChange(value as ProductStatus)}
            >
              <SelectTrigger id="status" className="w-full data-[size=default]:h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="active">Publicado</SelectItem>
                <SelectItem value="archived">Arquivado</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-ink-muted">
              Os botões no rodapé também mudam esta situação.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="position">Posição na listagem</Label>
            <Input
              id="position"
              name="position"
              type="number"
              min={0}
              value={position}
              onChange={(e) => onPositionChange(e.target.value)}
              onFocus={selectOnFocus}
              className="h-10"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="tag-input">Tags</Label>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-xs text-fg"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => onTagsChange(tags.filter((t) => t !== tag))}
                  aria-label={`Remover tag ${tag}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <input
              id="tag-input"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={() => {
                addTag(tagInput);
                setTagInput("");
              }}
              placeholder={tags.length === 0 ? "Digite e pressione Enter" : ""}
              className="min-w-32 flex-1 bg-transparent px-1 py-1 text-sm outline-none"
            />
          </div>
        </div>

        <AttributesEditor rows={attributeRows} onChange={onAttributeRowsChange} />

        <div className="flex flex-col gap-2">
          <Label>SKU</Label>
          {singlePiece ? (
            <div className="sm:max-w-xs">
              <Input
                id="simple-sku"
                value={simpleSku}
                onChange={(e) => onSimpleSkuChange(e.target.value)}
                placeholder="Gerado pelo slug do produto"
                className="h-10"
              />
              {simpleSku.trim() !== "" && existingSkus.includes(simpleSku.trim()) && (
                <p className="mt-1 text-xs text-[var(--danger)]">
                  Esse SKU já está em uso por outro produto.
                </p>
              )}
            </div>
          ) : variants.length === 0 ? (
            <p className="text-xs text-ink-muted">
              Os SKUs aparecem aqui depois que as cores e tamanhos forem definidos.
            </p>
          ) : (
            <>
              <p className="text-xs text-ink-muted">
                Gerados automaticamente como SLUG-COR-TAMANHO. Edite só se precisar de um
                código específico.
              </p>
              <div className="flex flex-col gap-2">
                {variants.map((variant) => {
                  const duplicated = existingSkus.includes(variant.sku);
                  return (
                    <div
                      key={variant.clientId}
                      className="flex flex-wrap items-center gap-2 sm:flex-nowrap"
                    >
                      <span className="w-40 shrink-0 truncate text-xs text-ink-muted">
                        {isColorlessVariant(variant.color)
                          ? variant.size
                          : `${variant.color || "sem cor"} · ${variant.size}`}
                      </span>
                      <Input
                        value={variant.sku}
                        onChange={(e) => onVariantSkuChange(variant.clientId, e.target.value)}
                        aria-label={`SKU de ${
                          isColorlessVariant(variant.color) ? "" : `${variant.color} `
                        }${variant.size}`}
                        aria-invalid={duplicated}
                        title={duplicated ? "Esse SKU já está em uso por outro produto" : undefined}
                        className="h-9 sm:max-w-xs"
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="shipping_note">Prazo de envio</Label>
          <Input
            id="shipping_note"
            name="shipping_note"
            value={shippingNote}
            onChange={(e) => onShippingNoteChange(e.target.value)}
            placeholder="Ex: Envio em até 2 dias úteis (em branco usa o padrão da loja)"
            className="h-10"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="exchange_info">Informações de troca</Label>
            <Textarea
              id="exchange_info"
              name="exchange_info"
              rows={3}
              value={exchangeInfo}
              onChange={(e) => onExchangeInfoChange(e.target.value)}
              placeholder="Em branco usa a política padrão da loja"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="care_instructions">Cuidados com a peça</Label>
            <Textarea
              id="care_instructions"
              name="care_instructions"
              rows={3}
              value={careInstructions}
              onChange={(e) => onCareInstructionsChange(e.target.value)}
              placeholder="Ex: Lavar à mão, não usar alvejante"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
