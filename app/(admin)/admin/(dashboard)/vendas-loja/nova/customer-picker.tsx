"use client";

import { useEffect, useRef, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StoreCustomerDialog } from "@/components/admin/store-customer-dialog";
import { formatPhone } from "@/lib/format";
import { searchStoreCustomersAction } from "@/lib/actions/store-sales";
import type { StoreCustomerOption } from "@/lib/data/store-sales";

/** Picks a customer of the store's book — or registers one on the spot. */
export function CustomerPicker({
  value,
  onChange,
}: {
  value: StoreCustomerOption | null;
  onChange: (customer: StoreCustomerOption | null) => void;
}) {
  const [term, setTerm] = useState("");
  const [options, setOptions] = useState<StoreCustomerOption[]>([]);
  const [searched, setSearched] = useState("");
  const [creating, setCreating] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const clean = term.trim();
    const id = ++requestId.current;
    if (clean.length < 2) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(() => {
      void searchStoreCustomersAction(clean).then((found) => {
        if (id !== requestId.current) return;
        setOptions(found);
        setSearched(clean);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [term]);

  function pick(customer: StoreCustomerOption) {
    onChange(customer);
    setTerm("");
    setOptions([]);
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-line-strong bg-field px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{value.name}</p>
          {value.phone && <p className="text-xs text-ink-muted">{formatPhone(value.phone)}</p>}
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(null)} aria-label="Tirar o cliente da venda">
          <X aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Buscar por nome ou telefone"
        aria-label="Buscar cliente"
        autoComplete="off"
      />
      {options.length > 0 && (
        <ul className="flex flex-col overflow-hidden rounded-lg border border-line">
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => pick(option)}
                className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm transition-colors duration-150 ease-out hover:bg-[var(--accent-soft)]"
              >
                <span className="truncate">{option.name}</span>
                {option.phone && <span className="shrink-0 text-xs text-ink-muted">{formatPhone(option.phone)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {searched !== "" && searched === term.trim() && options.length === 0 && (
        <p className="text-xs text-ink-muted">Nenhum cliente com esse nome ou telefone.</p>
      )}
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setCreating(true)}>
        <UserPlus aria-hidden="true" />
        Cadastrar cliente
      </Button>
      <StoreCustomerDialog
        open={creating}
        onOpenChange={setCreating}
        initialName={/\d/.test(term) ? "" : term.trim()}
        onSaved={pick}
      />
    </div>
  );
}
