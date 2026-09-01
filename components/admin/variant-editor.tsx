"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type VariantDraft = {
  color: string;
  color_hex: string;
  size: string;
  sku: string;
  stock: number;
};

const EMPTY_VARIANT: VariantDraft = {
  color: "",
  color_hex: "#0A0A0A",
  size: "",
  sku: "",
  stock: 0,
};

export function VariantEditor({
  variants,
  onChange,
}: {
  variants: VariantDraft[];
  onChange: (variants: VariantDraft[]) => void;
}) {
  function update(index: number, patch: Partial<VariantDraft>) {
    onChange(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  function remove(index: number) {
    onChange(variants.filter((_, i) => i !== index));
  }

  function add() {
    onChange([...variants, { ...EMPTY_VARIANT }]);
  }

  return (
    <div>
      <p className="text-label mb-3">Variações (cor × tamanho)</p>
      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-label">
              <th className="p-3 text-left">Cor</th>
              <th className="p-3 text-left">Hex</th>
              <th className="p-3 text-left">Tamanho</th>
              <th className="p-3 text-left">SKU</th>
              <th className="p-3 text-left">Estoque</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {variants.map((variant, index) => (
              <tr key={index} className="border-b border-line/50 last:border-0">
                <td className="p-2">
                  <Input
                    value={variant.color}
                    onChange={(e) => update(index, { color: e.target.value })}
                    placeholder="Preto"
                    className="rounded-none"
                  />
                </td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={variant.color_hex || "#0A0A0A"}
                      onChange={(e) => update(index, { color_hex: e.target.value })}
                      className="size-8 shrink-0 border border-line bg-transparent"
                      aria-label="Cor (hex)"
                    />
                    <Input
                      value={variant.color_hex}
                      onChange={(e) => update(index, { color_hex: e.target.value })}
                      className="w-24 rounded-none"
                    />
                  </div>
                </td>
                <td className="p-2">
                  <Input
                    value={variant.size}
                    onChange={(e) => update(index, { size: e.target.value })}
                    placeholder="M"
                    className="w-20 rounded-none"
                  />
                </td>
                <td className="p-2">
                  <Input
                    value={variant.sku}
                    onChange={(e) => update(index, { sku: e.target.value })}
                    className="rounded-none"
                  />
                </td>
                <td className="p-2">
                  <Input
                    type="number"
                    min={0}
                    value={variant.stock}
                    onChange={(e) => update(index, { stock: Number(e.target.value) })}
                    className="w-24 rounded-none"
                  />
                </td>
                <td className="p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(index)}
                    aria-label="Remover variação"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={add}>
        <Plus className="size-4" /> Adicionar variação
      </Button>
    </div>
  );
}
