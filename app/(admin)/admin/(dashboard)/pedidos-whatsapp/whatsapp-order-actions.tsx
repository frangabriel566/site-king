"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelWhatsAppOrderAction,
  checkCouponPhoneAction,
  confirmWhatsAppOrderAction,
  removeWhatsAppOrderDiscountAction,
} from "@/lib/actions/whatsapp-orders";

type Dialog = "confirm" | "cancel" | null;

/** "(11) 98888-7777" as it is typed; the server keeps only the digits. */
function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  const split = digits.length === 11 ? 7 : 6;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}-${digits.slice(split)}`;
}

/**
 * Os dois desfechos de um pedido de WhatsApp.
 *
 * "Confirmar venda" baixa estoque de verdade e conta o uso do cupom — por
 * isso passa por confirmação, como qualquer exclusão do painel. A baixa
 * acontece inteira numa transação: se faltar saldo de uma peça, ou o
 * cupom tiver chegado ao limite com outras vendas, nada muda e o erro diz
 * por quê.
 *
 * Na confirmação a loja pode informar o telefone do cliente (opcional).
 * Com cupom de "um uso por telefone", um telefone que já usou o cupom em
 * outra venda confirmada é avisado — sem bloquear — com a opção de tirar
 * o desconto antes de confirmar.
 */
export function WhatsAppOrderActions({
  orderId,
  code,
  total,
  couponCode = null,
  discount = null,
  onePerPhone = false,
  initialPhone = "",
}: {
  orderId: string;
  code: string;
  total: string;
  /** The order's coupon and its discount, already formatted. */
  couponCode?: string | null;
  discount?: string | null;
  /** The coupon is "um uso por telefone". */
  onePerPhone?: boolean;
  /** The phone of a registered customer, offered in the field. */
  initialPhone?: string;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pending, startTransition] = useTransition();
  const [phone, setPhone] = useState(maskPhone(initialPhone));
  const [repeated, setRepeated] = useState<string[]>([]);
  const [couponLimit, setCouponLimit] = useState(false);
  const [discountRemoved, setDiscountRemoved] = useState(false);
  const hasCoupon = Boolean(couponCode) && !discountRemoved;

  function checkPhone(value: string) {
    const digits = value.replace(/\D/g, "");
    if (!hasCoupon || !onePerPhone || (digits.length !== 10 && digits.length !== 11)) {
      setRepeated([]);
      return;
    }
    void checkCouponPhoneAction({ order_id: orderId, phone: digits }).then((result) =>
      setRepeated(result.previous.map((order) => order.label)),
    );
  }

  function removeDiscount() {
    startTransition(async () => {
      const result = await removeWhatsAppOrderDiscountAction({ order_id: orderId });
      if (result.ok) {
        setDiscountRemoved(true);
        setRepeated([]);
        setCouponLimit(false);
        toast.success(`Desconto removido do pedido #${code}.`);
        router.refresh();
      } else {
        toast.error(result.message ?? "Não foi possível remover o desconto.");
      }
    });
  }

  function run(kind: Exclude<Dialog, null>, removeDiscountFirst = false) {
    startTransition(async () => {
      const result =
        kind === "confirm"
          ? await confirmWhatsAppOrderAction({
              order_id: orderId,
              phone,
              remove_discount: removeDiscountFirst,
            })
          : await cancelWhatsAppOrderAction({ order_id: orderId });

      if (result.ok) {
        toast.success(
          kind === "confirm"
            ? `Venda #${code} confirmada. Estoque baixado.`
            : `Pedido #${code} cancelado.`,
        );
        setDialog(null);
        return;
      }
      // The coupon ran out with other sales: the dialog offers confirming
      // without the discount instead of a dead end.
      if (result.couponLimit) setCouponLimit(true);
      toast.error(result.message ?? "Não foi possível concluir a operação.");
    });
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          onClick={() => {
            setDialog("confirm");
            // A registered customer's phone is already in the field.
            checkPhone(phone);
          }}
          disabled={pending}
        >
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

          {dialog === "confirm" && (
            <div className="flex flex-col gap-4 text-sm">
              {hasCoupon && (
                <p className="text-ink-muted">
                  Cupom <strong className="text-fg">{couponCode}</strong>
                  {discount ? `: ${discount}` : ""}
                  {onePerPhone ? " · um uso por telefone" : ""}
                </p>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor={`phone-${orderId}`}>Telefone do cliente (opcional)</Label>
                <Input
                  id={`phone-${orderId}`}
                  value={phone}
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="(11) 98888-7777"
                  onChange={(event) => {
                    const masked = maskPhone(event.target.value);
                    setPhone(masked);
                    checkPhone(masked);
                  }}
                />
                <p className="text-xs text-ink-muted">Com DDD. Fica guardado no pedido.</p>
              </div>

              {hasCoupon && repeated.length > 0 && (
                <div role="alert" className="rounded-md border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-3">
                  <p className="text-fg">
                    Este telefone já usou o cupom {couponCode} em {repeated.join(", ")}.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={removeDiscount}
                    disabled={pending}
                  >
                    Remover desconto
                  </Button>
                </div>
              )}

              {hasCoupon && couponLimit && (
                <div role="alert" className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-3">
                  <p className="text-fg">
                    O cupom {couponCode} já atingiu o limite de usos com outras vendas.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-2"
                    onClick={() => run("confirm", true)}
                    disabled={pending}
                  >
                    Confirmar sem o desconto
                  </Button>
                </div>
              )}
            </div>
          )}

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
