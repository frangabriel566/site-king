"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  createAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
} from "@/lib/actions/addresses";
import { AddressFields, EMPTY_ADDRESS, type AddressFieldsValue } from "@/components/shop/address-fields";
import type { Address } from "@/lib/data/addresses";

export function AddressManager({ addresses }: { addresses: Address[] }) {
  const [showForm, setShowForm] = useState(addresses.length === 0);
  const [value, setValue] = useState<AddressFieldsValue>(EMPTY_ADDRESS);
  const [isDefault, setIsDefault] = useState(addresses.length === 0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const formData = new FormData();
      Object.entries(value).forEach(([k, v]) => formData.set(k, v));
      if (isDefault) formData.set("is_default", "on");
      const result = await createAddressAction({ status: "idle" }, formData);
      if (result.status === "success") {
        toast.success("Endereço salvo.");
        setValue(EMPTY_ADDRESS);
        setShowForm(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Não foi possível salvar.");
      }
    });
  }

  return (
    <div className="max-w-xl">
      {addresses.length > 0 && (
        <ul className="mb-8 flex flex-col gap-4">
          {addresses.map((address) => (
            <li key={address.id} className="rounded-lg border border-line p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="text-sm">
                  <p>
                    {address.street}, {address.number}
                    {address.complement ? ` — ${address.complement}` : ""}
                  </p>
                  <p className="text-ink-muted">
                    {address.district}, {address.city} — {address.state}
                  </p>
                  <p className="text-ink-muted">{address.cep}</p>
                  {address.is_default && (
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gold-text">
                      Padrão
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 text-xs">
                  {!address.is_default && (
                    <button
                      type="button"
                      className="text-ink-muted hover:text-fg"
                      onClick={() =>
                        startTransition(async () => {
                          await setDefaultAddressAction(address.id);
                          router.refresh();
                        })
                      }
                    >
                      Tornar padrão
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-ink-muted hover:text-alert"
                    onClick={() =>
                      startTransition(async () => {
                        await deleteAddressAction(address.id);
                        toast.success("Endereço removido.");
                        router.refresh();
                      })
                    }
                  >
                    Remover
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <AddressFields value={value} onChange={setValue} idPrefix="account" />
          <div className="flex items-center gap-3">
            <Checkbox
              id="is_default"
              checked={isDefault}
              onCheckedChange={(v) => setIsDefault(v === true)}
            />
            <Label htmlFor="is_default">Definir como endereço padrão</Label>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Salvando…" : "Salvar endereço"}
            </Button>
            {addresses.length > 0 && (
              <Button type="button" variant="outline" size="lg" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      ) : (
        <Button variant="outline" size="lg" onClick={() => setShowForm(true)}>
          <Plus className="size-4" /> Novo endereço
        </Button>
      )}
    </div>
  );
}
