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

const STATUS_OPTIONS = [
  { value: "all", label: "Todos os status" },
  { value: "pending", label: "Aguardando pagamento" },
  { value: "paid", label: "Pago" },
  { value: "processing", label: "Em preparação" },
  { value: "shipped", label: "Enviado" },
  { value: "delivered", label: "Entregue" },
  { value: "canceled", label: "Cancelado" },
];

export function OrdersFilterBar({
  status,
  search,
}: {
  status?: string;
  search?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    router.push(`/admin/pedidos?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={status ?? "all"} onValueChange={(v) => update("status", v)}>
        <SelectTrigger className="w-full rounded-none sm:w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-none">
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        defaultValue={search}
        placeholder="Buscar por número ou cliente"
        className="w-full rounded-none sm:w-64"
        onKeyDown={(e) => {
          if (e.key === "Enter") update("busca", e.currentTarget.value);
        }}
      />
    </div>
  );
}
