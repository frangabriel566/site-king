"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { X, SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useCloseOnNavigation } from "@/lib/hooks/use-close-on-navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/format";
import type { Category } from "@/lib/data/categories";
import type { Brand } from "@/lib/data/brands";
import type { FilterOptions } from "@/lib/data/products";

function toggleValue(current: string[], value: string): string[] {
  return current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
}

export function CollectionFilters({
  categories,
  brands,
  options,
  priceBounds,
}: {
  categories: Category[];
  brands: Brand[];
  options: FilterOptions;
  priceBounds: { min: number; max: number };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Picking a filter only rewrites the query string and deliberately
  // leaves this open. Leaving the collection page entirely, or stepping
  // back out of it, must not — this component unmounts with the page,
  // and a Dialog torn down while still open is the one case its own
  // cleanup is least likely to survive.
  useCloseOnNavigation(useCallback(() => setMobileOpen(false), []));

  const activeCategory = searchParams.get("categoria") ?? "";
  const activeBrand = searchParams.get("marca") ?? "";
  const activeSizes = (searchParams.get("tamanho") ?? "").split(",").filter(Boolean);
  const activeColors = (searchParams.get("cor") ?? "").split(",").filter(Boolean);
  const onSale = searchParams.get("promocao") === "1";
  const priceMin = searchParams.get("preco_min")
    ? Number(searchParams.get("preco_min"))
    : Math.floor(priceBounds.min);
  const priceMax = searchParams.get("preco_max")
    ? Number(searchParams.get("preco_max"))
    : Math.ceil(priceBounds.max);
  const [priceRange, setPriceRange] = useState<[number, number]>([priceMin, priceMax]);

  const hasActiveFilters =
    activeCategory ||
    activeBrand ||
    activeSizes.length > 0 ||
    activeColors.length > 0 ||
    onSale ||
    searchParams.get("preco_min") ||
    searchParams.get("preco_max");

  function updateParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete("pagina");
    router.push(`/colecao?${params.toString()}`, { scroll: false });
  }

  function setCategory(slug: string) {
    updateParams((params) => {
      if (slug) params.set("categoria", slug);
      else params.delete("categoria");
    });
  }

  function setBrand(slug: string) {
    updateParams((params) => {
      if (slug) params.set("marca", slug);
      else params.delete("marca");
    });
  }

  function toggleSize(size: string) {
    updateParams((params) => {
      const next = toggleValue(activeSizes, size);
      if (next.length > 0) params.set("tamanho", next.join(","));
      else params.delete("tamanho");
    });
  }

  function toggleColor(color: string) {
    updateParams((params) => {
      const next = toggleValue(activeColors, color);
      if (next.length > 0) params.set("cor", next.join(","));
      else params.delete("cor");
    });
  }

  function toggleOnSale(checked: boolean) {
    updateParams((params) => {
      if (checked) params.set("promocao", "1");
      else params.delete("promocao");
    });
  }

  function applyPrice(range: [number, number]) {
    updateParams((params) => {
      if (range[0] > Math.floor(priceBounds.min)) params.set("preco_min", String(range[0]));
      else params.delete("preco_min");
      if (range[1] < Math.ceil(priceBounds.max)) params.set("preco_max", String(range[1]));
      else params.delete("preco_max");
    });
  }

  function clearAll() {
    router.push("/colecao", { scroll: false });
  }

  const content = (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Categoria
        </p>
        <ul className="flex flex-col gap-2">
          <li>
            <button
              type="button"
              onClick={() => setCategory("")}
              className={`text-sm transition-colors duration-150 ease-out ${
                !activeCategory ? "font-semibold text-gold-text" : "text-fg hover:text-gold-text"
              }`}
            >
              Todas
            </button>
          </li>
          {categories.map((category) => (
            <li key={category.id}>
              <button
                type="button"
                onClick={() => setCategory(category.slug)}
                className={`text-sm transition-colors duration-150 ease-out ${
                  activeCategory === category.slug
                    ? "font-semibold text-gold-text"
                    : "text-fg hover:text-gold-text"
                }`}
              >
                {category.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {brands.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Marca
          </p>
          <ul className="flex flex-col gap-2">
            <li>
              <button
                type="button"
                onClick={() => setBrand("")}
                className={`text-sm transition-colors duration-150 ease-out ${
                  !activeBrand ? "font-semibold text-gold-text" : "text-fg hover:text-gold-text"
                }`}
              >
                Todas
              </button>
            </li>
            {brands.map((brand) => (
              <li key={brand.id}>
                <button
                  type="button"
                  onClick={() => setBrand(brand.slug)}
                  className={`text-sm transition-colors duration-150 ease-out ${
                    activeBrand === brand.slug
                      ? "font-semibold text-gold-text"
                      : "text-fg hover:text-gold-text"
                  }`}
                >
                  {brand.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {options.sizes.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tamanho
          </p>
          <div className="flex flex-wrap gap-2">
            {options.sizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => toggleSize(size)}
                aria-pressed={activeSizes.includes(size)}
                className={`h-9 min-w-9 rounded-md border px-3 text-xs font-medium uppercase transition-colors duration-150 ease-out ${
                  activeSizes.includes(size)
                    ? "border-cta bg-cta text-white"
                    : "border-line text-fg hover:border-cta"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {options.colors.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cor
          </p>
          <div className="flex flex-wrap gap-3">
            {options.colors.map(({ color, color_hex }) => (
              <button
                key={color}
                type="button"
                onClick={() => toggleColor(color)}
                aria-pressed={activeColors.includes(color)}
                title={color}
                className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors duration-150 ease-out ${
                  activeColors.includes(color)
                    ? "border-cta text-fg"
                    : "border-line text-muted-foreground hover:border-cta hover:text-fg"
                }`}
              >
                <span
                  className="size-3 rounded-full border border-line"
                  style={{ backgroundColor: color_hex ?? "#8A8A8A" }}
                  aria-hidden="true"
                />
                {color}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Preço
        </p>
        <Slider
          min={Math.floor(priceBounds.min)}
          max={Math.max(Math.ceil(priceBounds.max), 1)}
          step={10}
          value={priceRange}
          onValueChange={(v) => setPriceRange(v as [number, number])}
          onValueCommit={(v) => applyPrice(v as [number, number])}
        />
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatCurrency(priceRange[0])}</span>
          <span>{formatCurrency(priceRange[1])}</span>
        </div>
      </div>

      <label className="flex items-center gap-2.5">
        <Checkbox checked={onSale} onCheckedChange={(v) => toggleOnSale(v === true)} />
        <span className="text-sm text-fg">Somente promoções</span>
      </label>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="self-start text-sm font-medium text-fg underline underline-offset-4 hover:text-gold-text"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="hidden w-60 shrink-0 lg:block">{content}</div>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="mb-4 flex min-h-11 touch-manipulation items-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-medium lg:hidden"
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        Filtrar {hasActiveFilters ? "•" : ""}
      </button>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="storefront-theme w-full max-w-full gap-0 overflow-y-auto border-r border-line bg-white p-6 text-fg sm:max-w-sm"
        >
          <SheetTitle className="sr-only">Filtros</SheetTitle>
          <div className="mb-6 flex items-center justify-between">
            <span className="text-sm font-semibold uppercase tracking-wide">Filtrar</span>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar filtros"
              className="-mr-2.5 flex size-11 touch-manipulation items-center justify-center"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          {content}
        </SheetContent>
      </Sheet>
    </>
  );
}
