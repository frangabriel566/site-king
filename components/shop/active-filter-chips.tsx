"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import type { Category } from "@/lib/data/categories";
import type { Brand } from "@/lib/data/brands";

export function ActiveFilterChips({
  categories,
  brands,
}: {
  categories: Category[];
  brands: Brand[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const category = searchParams.get("categoria");
  const brand = searchParams.get("marca");
  const sizes = (searchParams.get("tamanho") ?? "").split(",").filter(Boolean);
  const colors = (searchParams.get("cor") ?? "").split(",").filter(Boolean);
  const onSale = searchParams.get("promocao") === "1";
  const priceMin = searchParams.get("preco_min");
  const priceMax = searchParams.get("preco_max");

  function remove(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete("pagina");
    router.push(`/colecao?${params.toString()}`, { scroll: false });
  }

  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  if (category) {
    const name = categories.find((c) => c.slug === category)?.name ?? category;
    chips.push({
      key: "categoria",
      label: name,
      onRemove: () => remove((p) => p.delete("categoria")),
    });
  }
  if (brand) {
    const name = brands.find((b) => b.slug === brand)?.name ?? brand;
    chips.push({ key: "marca", label: name, onRemove: () => remove((p) => p.delete("marca")) });
  }
  for (const size of sizes) {
    chips.push({
      key: `tamanho-${size}`,
      label: `Tamanho ${size}`,
      onRemove: () =>
        remove((p) => {
          const next = sizes.filter((s) => s !== size);
          if (next.length > 0) p.set("tamanho", next.join(","));
          else p.delete("tamanho");
        }),
    });
  }
  for (const color of colors) {
    chips.push({
      key: `cor-${color}`,
      label: color,
      onRemove: () =>
        remove((p) => {
          const next = colors.filter((c) => c !== color);
          if (next.length > 0) p.set("cor", next.join(","));
          else p.delete("cor");
        }),
    });
  }
  if (onSale) {
    chips.push({
      key: "promocao",
      label: "Somente promoções",
      onRemove: () => remove((p) => p.delete("promocao")),
    });
  }
  if (priceMin || priceMax) {
    chips.push({
      key: "preco",
      label: "Faixa de preço",
      onRemove: () =>
        remove((p) => {
          p.delete("preco_min");
          p.delete("preco_max");
        }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg hover:border-cta"
        >
          {chip.label}
          <X className="size-3" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
