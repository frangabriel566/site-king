"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPhone } from "@/lib/format";
import { createStoreCustomerAction, updateStoreCustomerAction } from "@/lib/actions/store-sales";
import type { StoreCustomerOption } from "@/lib/data/store-sales";

export type StoreCustomerDraft = {
  id?: string;
  name: string;
  phone: string | null;
  birthdate: string | null;
};

/**
 * Cadastro de cliente da loja: only the name is required. The phone is
 * what the birthday message goes to, the birthday is what puts the
 * customer on the "Aniversariantes" list.
 */
export function StoreCustomerDialog({
  open,
  onOpenChange,
  customer,
  initialName = "",
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing this customer; omitted to create one. */
  customer?: StoreCustomerDraft;
  /** What was typed in the picker, to start the new customer's name. */
  initialName?: string;
  onSaved?: (customer: StoreCustomerOption) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setName(customer?.name ?? initialName);
    setPhone(customer?.phone ? formatPhone(customer.phone) : "");
    setBirthdate(customer?.birthdate ?? "");
  }, [open, customer, initialName]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const values = { name, phone, birthdate };
      const result = customer?.id
        ? await updateStoreCustomerAction({ ...values, customer_id: customer.id })
        : await createStoreCustomerAction(values);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(customer?.id ? "Cliente atualizado." : `Cadastro de ${result.customer.name} criado.`);
      onSaved?.(result.customer);
      onOpenChange(false);
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-line bg-card text-fg sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-heading text-lg">{customer?.id ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>Só o nome é obrigatório.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="store-customer-name">Nome</Label>
            <Input
              id="store-customer-name"
              autoFocus
              required
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome do cliente"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="store-customer-phone">Telefone / WhatsApp (opcional)</Label>
            <Input
              id="store-customer-phone"
              inputMode="tel"
              autoComplete="off"
              value={phone}
              onChange={(event) => setPhone(formatPhone(event.target.value))}
              placeholder="(11) 98888-7777"
            />
            <p className="text-xs text-ink-muted">Com DDD. É para onde vai a mensagem de aniversário.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="store-customer-birthdate">Data de nascimento (opcional)</Label>
            <Input
              id="store-customer-birthdate"
              type="date"
              max={today}
              min="1900-01-01"
              value={birthdate}
              onChange={(event) => setBirthdate(event.target.value)}
              className="w-auto"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || name.trim().length < 2}>
              {pending ? "Salvando…" : customer?.id ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
