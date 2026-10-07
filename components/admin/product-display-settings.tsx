"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/** products.badge — the label on the product's card and page. It used to
 * pick the home shelf too; the home's rails are worked out from the data
 * now (lib/data/products.ts), so it is only the label. Empty is stored as
 * null. */
const NO_BADGE_VALUE = "__no_badge__";
const PLACEMENT_OPTIONS = [
  { value: NO_BADGE_VALUE, label: "Sem selo" },
  { value: "lancamento", label: "Lançamento" },
  { value: "mais_vendido", label: "Mais vendido" },
  { value: "oferta", label: "Oferta" },
];

export function ProductDisplaySettings({
  badge,
  onBadgeChange,
  featured,
  onFeaturedChange,
  collection,
  onCollectionChange,
}: {
  badge: string;
  onBadgeChange: (badge: string) => void;
  featured: boolean;
  onFeaturedChange: (featured: boolean) => void;
  collection: string;
  onCollectionChange: (collection: string) => void;
}) {
  return (
    <>
      <input type="hidden" name="badge" value={badge} />

      <div className="flex flex-col gap-2">
        <Label>Selo no produto</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PLACEMENT_OPTIONS.map((option) => {
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
          Aparece no card e na página do produto, quando não há um selo automático
          (Esgotado, Últimas unidades, Novo). As vitrines da home se montam sozinhas:
          Novidades (cadastrados por último), Ofertas (com preço &quot;de&quot; maior que o
          preço) e Mais vendidos (vendas confirmadas).
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
