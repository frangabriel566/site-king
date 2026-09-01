"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { X, SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { Category } from "@/lib/data/categories";
import type { FilterOptions } from "@/lib/data/products";

function toggleValue(current: string[], value: string): string[] {
  return current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
}

export function CollectionFilters({
  categories,
  options,
  priceBounds,
}: {
  categories: Category[];
  options: FilterOptions;
  priceBounds: { min: number; max: number };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeCategory = searchParams.get("categoria") ?? "";
  const activeSizes = (searchParams.get("tamanho") ?? "").split(",").filter(Boolean);
  const activeColors = (searchParams.get("cor") ?? "").split(",").filter(Boolean);
  const priceMin = searchParams.get("preco_min") ?? "";
  const priceMax = searchParams.get("preco_max") ?? "";

  const hasActiveFilters =
    activeCategory || activeSizes.length > 0 || activeColors.length > 0 || priceMin || priceMax;

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

  function applyPrice(formData: FormData) {
    const min = String(formData.get("preco_min") ?? "").trim();
    const max = String(formData.get("preco_max") ?? "").trim();
    updateParams((params) => {
      if (min) params.set("preco_min", min);
      else params.delete("preco_min");
      if (max) params.set("preco_max", max);
      else params.delete("preco_max");
    });
  }

  function clearAll() {
    router.push("/colecao", { scroll: false });
  }

  const content = (
    <div className="flex flex-col gap-10">
      <div>
        <p className="text-label mb-4">Categoria</p>
        <ul className="flex flex-col gap-2">
          <li>
            <button
              type="button"
              onClick={() => setCategory("")}
              className={`text-sm transition-colors duration-200 ease-out ${
                !activeCategory ? "text-gold" : "text-ink-muted hover:text-fg"
              }`}
            >
              Todos
            </button>
          </li>
          {categories.map((category) => (
            <li key={category.id}>
              <button
                type="button"
                onClick={() => setCategory(category.slug)}
                className={`text-sm transition-colors duration-200 ease-out ${
                  activeCategory === category.slug
                    ? "text-gold"
                    : "text-ink-muted hover:text-fg"
                }`}
              >
                {category.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {options.sizes.length > 0 && (
        <div>
          <p className="text-label mb-4">Tamanho</p>
          <div className="flex flex-wrap gap-2">
            {options.sizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => toggleSize(size)}
                aria-pressed={activeSizes.includes(size)}
                className={`h-9 min-w-9 border px-3 text-xs uppercase transition-colors duration-200 ease-out ${
                  activeSizes.includes(size)
                    ? "border-fg bg-fg text-bg"
                    : "border-line text-fg hover:border-fg"
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
          <p className="text-label mb-4">Cor</p>
          <div className="flex flex-wrap gap-3">
            {options.colors.map(({ color, color_hex }) => (
              <button
                key={color}
                type="button"
                onClick={() => toggleColor(color)}
                aria-pressed={activeColors.includes(color)}
                title={color}
                className={`flex items-center gap-2 border px-2 py-1.5 text-xs transition-colors duration-200 ease-out ${
                  activeColors.includes(color)
                    ? "border-fg text-fg"
                    : "border-line text-ink-muted hover:border-fg hover:text-fg"
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
        <p className="text-label mb-4">Preço</p>
        <form
          action={applyPrice}
          className="flex items-center gap-3"
        >
          <input
            type="number"
            name="preco_min"
            defaultValue={priceMin}
            placeholder={String(Math.floor(priceBounds.min))}
            aria-label="Preço mínimo"
            min={0}
            className="w-full min-w-0 border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <span className="text-ink-muted">—</span>
          <input
            type="number"
            name="preco_max"
            defaultValue={priceMax}
            placeholder={String(Math.ceil(priceBounds.max))}
            aria-label="Preço máximo"
            min={0}
            className="w-full min-w-0 border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <Button type="submit" variant="outline" size="sm">
            Aplicar
          </Button>
        </form>
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="text-label self-start !text-fg hover:!text-gold"
        >
          Limpar filtros ×
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="hidden w-56 shrink-0 lg:block">{content}</div>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="text-label mb-6 flex items-center gap-2 lg:hidden"
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        Filtrar {hasActiveFilters ? "•" : ""}
      </button>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-full max-w-full gap-0 overflow-y-auto border-r border-line bg-bg p-8 sm:max-w-sm"
        >
          <SheetTitle className="sr-only">Filtros</SheetTitle>
          <div className="mb-8 flex items-center justify-between">
            <span className="text-label !text-fg">Filtrar</span>
            <button type="button" onClick={() => setMobileOpen(false)} aria-label="Fechar filtros">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          {content}
        </SheetContent>
      </Sheet>
    </>
  );
}
