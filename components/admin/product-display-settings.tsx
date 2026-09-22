"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/** products.badge — one storefront shelf per product. The empty value is
 * the plain catalog ("Produtos"), which is how the column stores it. */
const NO_BADGE_VALUE = "__no_badge__";
const PLACEMENT_OPTIONS = [
  { value: NO_BADGE_VALUE, label: "Produtos" },
  { value: "lancamento", label: "Lançamentos" },
  { value: "mais_vendido", label: "Mais vendidos" },
  { value: "oferta", label: "Ofertas" },
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
        <Label>Onde aparece na home</Label>
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
          O produto aparece só na vitrine escolhida. Em todas elas ele continua no catálogo
          da loja (/coleção).
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
          <span className="text-sm text-fg">Aparecer primeiro na vitrine</span>
        </label>
        <p className="text-xs text-ink-muted">
          Põe este produto na frente dos outros dentro da vitrine escolhida acima.
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
