"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InlineCategoryCreator } from "@/components/admin/inline-category-creator";
import { CurrencyInput } from "@/components/admin/currency-input";
import { selectOnFocus } from "@/lib/utils";
import type { Category } from "@/lib/data/categories";

const NEW_CATEGORY_VALUE = "__new_category__";
/** products.short_description caps at 300 in the schema. */
export const SHORT_DESCRIPTION_MAX = 300;

export function ProductBasicInfo({
  name,
  onNameChange,
  slug,
  onSlugChange,
  slugTaken,
  categories,
  categoryId,
  onCategoryChange,
  onCategoryCreated,
  price,
  onPriceChange,
  compareAtPrice,
  onCompareAtPriceChange,
  promoEnabled,
  onPromoEnabledChange,
  shortDescription,
  onShortDescriptionChange,
  invalidAnchors,
}: {
  name: string;
  onNameChange: (value: string) => void;
  slug: string;
  onSlugChange: (value: string) => void;
  /** products.slug is unique — another product already answers at this
   * address, so saving would be refused. */
  slugTaken: boolean;
  categories: Pick<Category, "id" | "name">[];
  categoryId: string;
  onCategoryChange: (value: string) => void;
  onCategoryCreated: (category: Pick<Category, "id" | "name">) => void;
  /** What the shopper pays — `products.price`. */
  price: string;
  onPriceChange: (value: string) => void;
  /** The struck-through "de" price — `products.compare_at_price`, and the
   * higher of the two whenever a promotion is on. */
  compareAtPrice: string;
  onCompareAtPriceChange: (value: string) => void;
  promoEnabled: boolean;
  onPromoEnabledChange: (enabled: boolean) => void;
  shortDescription: string;
  onShortDescriptionChange: (value: string) => void;
  /** Anchors of the publish issues raised by the last submit attempt —
   * nothing is marked invalid before the operator tries to publish. */
  invalidAnchors: Set<string>;
}) {
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  const promoTooHigh =
    promoEnabled &&
    price !== "" &&
    compareAtPrice !== "" &&
    Number(compareAtPrice) <= Number(price);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="name">
            Nome do produto <span className="text-accent-light">*</span>
          </Label>
          <Input
            id="name"
            name="name"
            required
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Ex: Camiseta Oversized Premium"
            className="h-10"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="slug-display">Slug</Label>
          <Input
            id="slug-display"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            placeholder="gerado pelo nome"
            aria-invalid={slugTaken}
            className="h-10"
          />
          {slugTaken ? (
            <p className="text-xs text-[var(--danger)]">
              Já existe outro produto neste endereço. Cada produto precisa do seu.
            </p>
          ) : (
            <p className="text-xs text-ink-muted">Endereço do produto na loja.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div id="field-category" className="flex scroll-mt-24 flex-col gap-2">
          <Label htmlFor="category_id">
            Categoria <span className="text-accent-light">*</span>
          </Label>
          <Select
            value={categoryId}
            onValueChange={(value) => {
              if (value === NEW_CATEGORY_VALUE) {
                setCategoryDialogOpen(true);
                return;
              }
              onCategoryChange(value);
            }}
          >
            <SelectTrigger
              id="category_id"
              aria-invalid={invalidAnchors.has("field-category")}
              className="w-full data-[size=default]:h-10"
            >
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
              <SelectItem value={NEW_CATEGORY_VALUE} className="!text-accent-light">
                <Plus className="size-3.5" /> Criar nova categoria
              </SelectItem>
            </SelectContent>
          </Select>
          <input type="hidden" name="category_id" value={categoryId} />
          <InlineCategoryCreator
            open={categoryDialogOpen}
            onOpenChange={setCategoryDialogOpen}
            onCreated={(category) => {
              onCategoryCreated(category);
              onCategoryChange(category.id);
            }}
          />
        </div>

        <div id="field-price" className="flex scroll-mt-24 flex-col gap-2">
          <Label htmlFor="price-field">
            Preço (R$) <span className="text-accent-light">*</span>
          </Label>
          {/* With a promotion on, this field IS compare_at_price — the "de"
              price the store strikes through — and the promotional field
              below carries products.price. The names swap, the values
              don't: price is always what the shopper actually pays. */}
          <CurrencyInput
            id="price-field"
            key={promoEnabled ? "compare" : "price"}
            name={promoEnabled ? "compare_at_price" : "price"}
            value={promoEnabled ? compareAtPrice : price}
            onValueChange={promoEnabled ? onCompareAtPriceChange : onPriceChange}
            onFocus={selectOnFocus}
            aria-invalid={invalidAnchors.has("field-price")}
            className="h-10"
          />
          {promoTooHigh && (
            <p className="text-xs text-[var(--danger)]">
              O preço promocional precisa ser menor que este.
            </p>
          )}
        </div>

        {promoEnabled && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="promo-price">Preço promocional (R$)</Label>
            <CurrencyInput
              id="promo-price"
              name="price"
              value={price}
              onValueChange={onPriceChange}
              onFocus={selectOnFocus}
              className="h-10"
            />
            <p className="text-xs text-ink-muted">É o valor que o cliente paga.</p>
          </div>
        )}
      </div>

      <label className="flex w-fit items-center gap-3">
        <Switch checked={promoEnabled} onCheckedChange={onPromoEnabledChange} />
        <span className="text-sm text-fg">Adicionar promoção</span>
      </label>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="short_description">Descrição curta</Label>
          <span className="text-xs text-ink-muted">
            {shortDescription.length}/{SHORT_DESCRIPTION_MAX}
          </span>
        </div>
        <Textarea
          id="short_description"
          name="short_description"
          rows={2}
          value={shortDescription}
          onChange={(e) => onShortDescriptionChange(e.target.value)}
          placeholder="Uma linha para o topo da página do produto"
          maxLength={SHORT_DESCRIPTION_MAX}
        />
      </div>
    </>
  );
}
