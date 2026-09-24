"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WHATSAPP_ORDER_FILTERS } from "@/lib/constants";

const FILTER_OPTIONS = Object.entries(WHATSAPP_ORDER_FILTERS).map(([value, config]) => ({
  value,
  label: config.label,
}));

export function WhatsAppFilterBar({
  filter,
  search,
}: {
  filter?: string;
  search?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/admin/pedidos-whatsapp?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={filter ?? "pendentes"} onValueChange={(v) => update("filtro", v)}>
        <SelectTrigger className="w-full sm:w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FILTER_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        defaultValue={search}
        placeholder="Buscar por código (ex: KS0007)"
        aria-label="Buscar pedido pelo código"
        className="w-full sm:w-72"
        onKeyDown={(e) => {
          if (e.key === "Enter") update("busca", e.currentTarget.value.trim());
        }}
      />
    </div>
  );
}
