"use client";

import { useState, useTransition } from "react";
import { Undo2 } from "lucide-react";
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
import { cancelStoreSaleAction } from "@/lib/actions/store-sales";

/** "Desfazer baixa" — a typo or a return: the pieces go back to stock. */
export function CancelSaleButton({ saleId, saleNumber, total }: { saleId: string; saleNumber: number; total: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await cancelStoreSaleAction({ sale_id: saleId });
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={pending}>
        <Undo2 aria-hidden="true" />
        Desfazer
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="border-line bg-card text-fg">
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer a baixa da venda #{saleNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              As peças voltam ao estoque e a venda de {total} sai dos totais. Ela continua no
              histórico, marcada como desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              // Keeps the dialog open until the server answers (see
              // whatsapp-order-actions.tsx).
              onClick={(event) => {
                event.preventDefault();
                run();
              }}
              disabled={pending}
            >
              {pending ? "Desfazendo…" : "Desfazer baixa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
