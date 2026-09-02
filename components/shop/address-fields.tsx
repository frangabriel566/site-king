"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lookupCepAction } from "@/lib/actions/cep";
import { formatCep } from "@/lib/format";

export type AddressFieldsValue = {
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

export function AddressFields({
  value,
  onChange,
  idPrefix = "address",
}: {
  value: AddressFieldsValue;
  onChange: (value: AddressFieldsValue | ((prev: AddressFieldsValue) => AddressFieldsValue)) => void;
  idPrefix?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [cepError, setCepError] = useState<string | null>(null);

  function update<K extends keyof AddressFieldsValue>(key: K, val: AddressFieldsValue[K]) {
    onChange({ ...value, [key]: val });
  }

  function handleCepBlur() {
    const digits = value.cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepError(null);
    startTransition(async () => {
      const result = await lookupCepAction(digits);
      if (result.ok) {
        // Functional update — the CEP lookup is async and this closure's
        // `value` is a snapshot from the moment the field lost focus. By
        // the time the response lands, the shopper may have already typed
        // the house number; merging onto the *current* state (via the
        // updater form) instead of that stale snapshot keeps it from being
        // silently wiped back to empty.
        onChange((prev) => ({
          ...prev,
          street: result.street || prev.street,
          district: result.district || prev.district,
          city: result.city || prev.city,
          state: result.state || prev.state,
        }));
      } else {
        setCepError(result.message);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-cep`}>CEP</Label>
        <div className="relative">
          <Input
            id={`${idPrefix}-cep`}
            name="cep"
            required
            value={value.cep}
            onChange={(e) => update("cep", formatCep(e.target.value))}
            onBlur={handleCepBlur}
            placeholder="00000-000"
          />
          {pending && (
            <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-muted" />
          )}
        </div>
        {cepError && <p className="text-xs text-alert">{cepError}</p>}
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-street`}>Endereço</Label>
        <Input
          id={`${idPrefix}-street`}
          name="street"
          required
          value={value.street}
          onChange={(e) => update("street", e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-number`}>Número</Label>
        <Input
          id={`${idPrefix}-number`}
          name="number"
          required
          value={value.number}
          onChange={(e) => update("number", e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-complement`}>Complemento</Label>
        <Input
          id={`${idPrefix}-complement`}
          name="complement"
          value={value.complement}
          onChange={(e) => update("complement", e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-district`}>Bairro</Label>
        <Input
          id={`${idPrefix}-district`}
          name="district"
          required
          value={value.district}
          onChange={(e) => update("district", e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-city`}>Cidade</Label>
        <Input
          id={`${idPrefix}-city`}
          name="city"
          required
          value={value.city}
          onChange={(e) => update("city", e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-state`}>Estado (UF)</Label>
        <Input
          id={`${idPrefix}-state`}
          name="state"
          required
          maxLength={2}
          value={value.state}
          onChange={(e) => update("state", e.target.value.toUpperCase())}
        />
      </div>
    </div>
  );
}

export const EMPTY_ADDRESS: AddressFieldsValue = {
  cep: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
};
