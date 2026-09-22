"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AttributeRow = { key: string; value: string };

/** Free-form key/value spec sheet (gola, manga, material, composição…),
 *  persisted as products.attributes (jsonb). Rows can be added/removed
 *  freely; empty keys are dropped on submit by the parent form. */
export function AttributesEditor({
  rows,
  onChange,
}: {
  rows: AttributeRow[];
  onChange: (rows: AttributeRow[]) => void;
}) {
  function update(index: number, patch: Partial<AttributeRow>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function remove(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  function add() {
    onChange([...rows, { key: "", value: "" }]);
  }

  return (
    <div>
      <Label className="mb-3 block">Ficha técnica</Label>
      <div className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              placeholder="Atributo (ex: Gola)"
              value={row.key}
              onChange={(e) => update(index, { key: e.target.value })}
            />
            <Input
              placeholder="Valor (ex: Careca)"
              value={row.value}
              onChange={(e) => update(index, { value: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Remover atributo"
              onClick={() => remove(index)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={add}>
        <Plus className="size-3.5" /> Adicionar atributo
      </Button>
    </div>
  );
}
