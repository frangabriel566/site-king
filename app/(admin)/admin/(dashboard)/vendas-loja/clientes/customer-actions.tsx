"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StoreCustomerDialog, type StoreCustomerDraft } from "@/components/admin/store-customer-dialog";
import { deleteStoreCustomerAction } from "@/lib/actions/store-sales";

/** Search box and "Novo cliente", above the list. */
export function CustomersToolbar({ search }: { search?: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Input
        defaultValue={search}
        placeholder="Buscar por nome ou telefone"
        aria-label="Buscar cliente"
        className="w-full sm:w-72"
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          const value = event.currentTarget.value.trim();
          router.push(value ? `/admin/vendas-loja/clientes?busca=${encodeURIComponent(value)}` : "/admin/vendas-loja/clientes");
        }}
      />
      <Button onClick={() => setCreating(true)}>
        <UserPlus aria-hidden="true" />
        Novo cliente
      </Button>
      <StoreCustomerDialog open={creating} onOpenChange={setCreating} onSaved={() => router.refresh()} />
    </div>
  );
}

/** Editar / Excluir on each row. */
export function CustomerRowActions({ customer }: { customer: StoreCustomerDraft & { id: string } }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteStoreCustomerAction({ customer_id: customer.id });
      if (result.ok) {
        toast.success(`Cadastro de ${customer.name} excluído.`);
        setDeleting(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Não foi possível excluir.");
      }
    });
  }

  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} aria-label={`Editar ${customer.name}`}>
        <Pencil aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setDeleting(true)}
        aria-label={`Excluir ${customer.name}`}
        className="text-ink-muted hover:text-[var(--danger)]"
      >
        <Trash2 aria-hidden="true" />
      </Button>

      <StoreCustomerDialog
        open={editing}
        onOpenChange={setEditing}
        customer={customer}
        onSaved={() => router.refresh()}
      />

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent className="border-line bg-card text-fg">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {customer.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              O cadastro sai da lista. As vendas feitas com ele continuam no histórico, com o nome do cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                remove();
              }}
              disabled={pending}
              className="bg-[var(--danger)] text-white hover:bg-[var(--danger)]/80"
            >
              {pending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
