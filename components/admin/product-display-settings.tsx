"use client";

import { AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PRODUCT_SECTIONS, SECTION_LABEL, type ProductSection } from "@/lib/sections";

/** One shelf the product is on, as the form holds it. */
export type SectionDraft = { section: ProductSection; position: number | null };

const SECTION_HINT: Partial<Record<ProductSection, string>> = {
  mais_vendidos: "Aparece primeiro; o resto da vitrine vem das vendas reais.",
};

/** products.badge — only the label on the product's card and page; it
 * does not decide any shelf (that's "Onde exibir no site"). Empty is
 * stored as null. */
const NO_BADGE_VALUE = "__no_badge__";
const BADGE_OPTIONS = [
  { value: NO_BADGE_VALUE, label: "Sem etiqueta" },
  { value: "lancamento", label: "Lançamento" },
  { value: "mais_vendido", label: "Mais vendido" },
  { value: "oferta", label: "Oferta" },
];

export function ProductDisplaySettings({
  sections,
  onSectionsChange,
  hasPromoPrice,
  badge,
  onBadgeChange,
  featured,
  onFeaturedChange,
  collection,
  onCollectionChange,
}: {
  sections: SectionDraft[];
  onSectionsChange: (sections: SectionDraft[]) => void;
  /** The "Preço promocional" is on and filled — Ofertas without one gets a
   * warning (never a block). */
  hasPromoPrice: boolean;
  badge: string;
  onBadgeChange: (badge: string) => void;
  featured: boolean;
  onFeaturedChange: (featured: boolean) => void;
  collection: string;
  onCollectionChange: (collection: string) => void;
}) {
  const entryFor = (section: ProductSection) => sections.find((entry) => entry.section === section);

  function toggle(section: ProductSection, checked: boolean) {
    const rest = sections.filter((entry) => entry.section !== section);
    // Kept in the home's order, so the saved list reads like the site.
    const next = checked ? [...rest, { section, position: null }] : rest;
    onSectionsChange(
      [...next].sort((a, b) => PRODUCT_SECTIONS.indexOf(a.section) - PRODUCT_SECTIONS.indexOf(b.section)),
    );
  }

  function setPosition(section: ProductSection, raw: string) {
    const value = raw.trim() === "" ? null : Math.max(1, Math.trunc(Number(raw)) || 1);
    onSectionsChange(
      sections.map((entry) => (entry.section === section ? { ...entry, position: value } : entry)),
    );
  }

  const offersWithoutPromo = Boolean(entryFor("ofertas")) && !hasPromoPrice;

  return (
    <>
      <input type="hidden" name="sections_json" value={JSON.stringify(sections)} />
      <input type="hidden" name="badge" value={badge} />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium text-fg">Onde exibir no site</legend>
        <p className="-mt-1 text-xs text-ink-muted">
          Cada vitrine da home mostra só os produtos marcados para ela. Marque nenhuma,
          uma ou várias. Na ordem, 1 aparece primeiro; em branco, depois dos numerados
          (os mais novos primeiro).
        </p>
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
          {PRODUCT_SECTIONS.map((section) => {
            const entry = entryFor(section);
            const id = `section-${section}`;
            return (
              <li key={section} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
                <label htmlFor={id} className="flex min-h-9 flex-1 cursor-pointer items-center gap-3">
                  <Checkbox
                    id={id}
                    checked={Boolean(entry)}
                    onCheckedChange={(checked) => toggle(section, checked === true)}
                  />
                  <span className="text-sm text-fg">
                    {SECTION_LABEL[section]}
                    {SECTION_HINT[section] && (
                      <span className="block text-xs text-ink-muted">{SECTION_HINT[section]}</span>
                    )}
                  </span>
                </label>
                {entry && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`${id}-position`} className="text-xs text-ink-muted">
                      Ordem
                    </Label>
                    <Input
                      id={`${id}-position`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      placeholder="—"
                      value={entry.position ?? ""}
                      onChange={(event) => setPosition(section, event.target.value)}
                      className="h-9 w-20"
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {offersWithoutPromo && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-fg"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            Marcado em Ofertas sem preço promocional: ele aparece na vitrine com o preço
            normal, sem desconto. Dá para salvar assim mesmo.
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label>Etiqueta no card</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BADGE_OPTIONS.map((option) => {
            const isActive = (badge || NO_BADGE_VALUE) === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onBadgeChange(option.value === NO_BADGE_VALUE ? "" : option.value)}
                aria-pressed={isActive}
                className={`flex h-11 items-center justify-center rounded-lg border px-2 text-sm font-medium transition-colors duration-150 ease-out ${
                  isActive
                    ? "border-accent-solid bg-accent-solid text-white"
                    : "border-line text-ink-muted hover:border-ink-muted hover:text-fg"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-ink-muted">
          Só a etiqueta no card e na página do produto (quando não há uma automática:
          Esgotado, Últimas unidades, Novo). <strong>Não muda onde o produto aparece</strong>{" "}
          — isso é a lista acima.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex w-fit items-center gap-3">
          <Switch
            id="featured"
            name="featured"
            checked={featured}
            onCheckedChange={onFeaturedChange}
          />
          <span className="text-sm text-fg">Aparecer primeiro no catálogo</span>
        </label>
        <p className="text-xs text-ink-muted">
          Põe este produto na frente dos outros na ordem &quot;Relevância&quot; do catálogo
          (/colecao). Não muda as vitrines da home.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:max-w-xs">
        <Label htmlFor="collection">Coleção (opcional)</Label>
        <Input
          id="collection"
          name="collection"
          value={collection}
          onChange={(e) => onCollectionChange(e.target.value)}
          placeholder="Ex: Verão 2026"
          className="h-10"
        />
      </div>
    </>
  );
}
