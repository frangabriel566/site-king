"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { updateVariantStockAction } from "@/lib/actions/products";
import { LOW_STOCK_THRESHOLD } from "@/lib/constants";

export function StockInput({ variantId, stock }: { variantId: string; stock: number }) {
  const [value, setValue] = useState(stock);
  const [pending, startTransition] = useTransition();

  function commit() {
    if (value === stock) return;
    startTransition(async () => {
      const result = await updateVariantStockAction(variantId, value);
      if (result.ok) {
        toast.success("Estoque atualizado.");
      } else {
        toast.error(result.message ?? "Não foi possível atualizar.");
        setValue(stock);
      }
    });
  }

  return (
    <Input
      type="number"
      min={0}
      value={value}
      disabled={pending}
      onChange={(e) => setValue(Number(e.target.value))}
      onBlur={commit}
      className={`w-24 rounded-none ${
        value <= LOW_STOCK_THRESHOLD ? "border-[var(--warning)] text-[var(--warning)]" : ""
      }`}
    />
  );
}
