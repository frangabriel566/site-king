"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SORT_OPTIONS } from "@/lib/collection-params";

export function CollectionSort() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("ordenar") ?? "relevancia";

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "relevancia") params.delete("ordenar");
    else params.set("ordenar", value);
    params.delete("pagina");
    router.push(`/colecao?${params.toString()}`, { scroll: false });
  }

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="w-44 border-line text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
