"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
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
import {
  cancelWhatsAppOrderAction,
  confirmWhatsAppOrderAction,
} from "@/lib/actions/whatsapp-orders";

type Dialog = "confirm" | "cancel" | null;

/**
 * Os dois desfechos de um pedido de WhatsApp.
 *
 * "Confirmar venda" baixa estoque de verdade — por isso passa por
 * confirmação, como qualquer exclusão do painel. A baixa acontece
 * inteira dentro de confirm_whatsapp_order(): se faltar saldo de uma
 * peça, nenhuma outra é decrementada e o erro nomeia qual faltou.
 */
export function WhatsAppOrderActions({
  orderId,
  code,
  total,
}: {
  orderId: string;
  code: string;
  total: string;
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pending, startTransition] = useTransition();

  function run(kind: Exclude<Dialog, null>) {
    startTransition(async () => {
      const result =
        kind === "confirm"
          ? await confirmWhatsAppOrderAction({ order_id: orderId })
          : await cancelWhatsAppOrderAction({ order_id: orderId });

      if (result.ok) {
        toast.success(
          kind === "confirm"
            ? `Venda #${code} confirmada. Estoque baixado.`
            : `Pedido #${code} cancelado.`,
        );
        setDialog(null);
      } else {
        toast.error(result.message ?? "Não foi possível concluir a operação.");
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" onClick={() => setDialog("confirm")} disabled={pending}>
          <Check className="size-3.5" aria-hidden="true" />
          Confirmar venda
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDialog("cancel")}
          disabled={pending}
          className="border-[var(--danger)]/40 text-[var(--danger)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
        >
          <X className="size-3.5" aria-hidden="true" />
          Cancelar
        </Button>
      </div>

      <AlertDialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent className="border-line bg-card text-fg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog === "confirm" ? `Confirmar a venda #${code}?` : `Cancelar o pedido #${code}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog === "confirm"
                ? `O pedido de ${total} passa a "Pago" e o estoque de cada variação é baixado na hora. Se faltar estoque de alguma peça, nada é baixado e você recebe o aviso.`
                : "O pedido some da fila de espera e nenhum estoque é movimentado. Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              // `preventDefault()` cancela o fechamento automático que o
              // AlertDialogAction traz de fábrica (o composeEventHandlers
              // do Radix pula o handler interno quando o default foi
              // impedido). Sem isso o diálogo sumia antes da resposta, e
              // com ele o "sem estoque de X" chega enquanto o atendente
              // ainda está olhando o pedido.
              onClick={(event) => {
                event.preventDefault();
                if (dialog) run(dialog);
              }}
              disabled={pending}
              className={
                dialog === "cancel"
                  ? "bg-[var(--danger)] text-white hover:bg-[var(--danger)]/80"
                  : undefined
              }
            >
              {pending
                ? "Processando…"
                : dialog === "confirm"
                  ? "Confirmar venda"
                  : "Cancelar pedido"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
