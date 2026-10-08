"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WhatsAppIcon } from "@/components/shop/whatsapp-icon";
import { createWhatsAppOrderAction } from "@/lib/actions/whatsapp-orders";
import { getCheckoutContextAction } from "@/lib/actions/checkout-context";
import { useCart } from "@/lib/cart/context";
import { CUSTOMER_NAME_STORAGE_KEY } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";

export type WhatsAppBuyItem = { variantId: string; qty: number };

function storedName(): string {
  try {
    return window.localStorage.getItem(CUSTOMER_NAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function rememberName(name: string) {
  try {
    window.localStorage.setItem(CUSTOMER_NAME_STORAGE_KEY, name);
  } catch {
    // Storage blocked: the name is just asked again next time.
  }
}

/**
 * "Comprar pelo WhatsApp" — o pedido é gravado antes de a conversa
 * abrir, com código próprio, e é isso que diferencia este botão de um
 * link `wa.me` qualquer: os dois lados passam a falar do mesmo pedido.
 *
 * Antes de abrir a conversa, uma janela pede só o nome — lembrado neste
 * navegador para a próxima compra, e já preenchido para quem tem conta.
 * Nada de CPF, telefone ou endereço: isso se resolve na conversa.
 *
 * Se o servidor recusar o cupom (venceu, esgotou), a janela diz por quê e
 * mostra o total novo; o cliente decide se segue sem ele.
 *
 * `getItems` devolve `null` quando quem chama ainda não tem uma escolha
 * válida (a página de produto sem tamanho selecionado, por exemplo) —
 * ela já mostrou o próprio erro nesse caso, então aqui é só parar.
 */
export function WhatsAppBuyButton({
  getItems,
  couponCode = null,
  label = "Comprar pelo WhatsApp",
  appearance = "whatsapp",
  disabled = false,
  className = "",
  size = "xl",
}: {
  getItems: () => WhatsAppBuyItem[] | null;
  /** The coupon applied where the button is (bag, drawer or product page);
   * the server decides whether it still applies. */
  couponCode?: string | null;
  label?: string;
  /** "buy": the bag's main button ("Finalizar compra") while the checkout
   * is closed — same order, dressed as the purchase it now is. */
  appearance?: "whatsapp" | "buy";
  disabled?: boolean;
  className?: string;
  size?: "lg" | "xl";
}) {
  // `useState` e não `useTransition`: a ação termina abrindo outra aba,
  // e o pending de uma transition continua preso ao render do React
  // depois que o foco já saiu da página.
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<WhatsAppBuyItem[]>([]);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  /** Set when the server turned the coupon down: the order goes on
   * without it, and the dialog shows the new total first. */
  const [couponDropped, setCouponDropped] = useState<{
    message: string;
    total: number | null;
  } | null>(null);
  const { setCouponCode } = useCart();

  function handleOpen() {
    const chosen = getItems();
    if (!chosen || chosen.length === 0) return;
    setItems(chosen);
    setNameError(null);
    setCouponDropped(null);
    const remembered = storedName();
    setName(remembered);
    setOpen(true);
    // Signed in and never typed a name here: the account's.
    if (!remembered) {
      void getCheckoutContextAction()
        .then((ctx) => {
          if (ctx.authenticated && ctx.name) setName((current) => current || ctx.name);
        })
        .catch(() => {});
    }
  }

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const customerName = name.trim();
    if (customerName.length < 2) {
      setNameError("Digite seu nome.");
      return;
    }
    rememberName(customerName);

    // A aba tem de ser aberta **dentro** do gesto do clique. Abrir depois
    // do `await` é o que o bloqueador de pop-up de todo navegador móvel
    // recusa, e era assim que o botão simplesmente não fazia nada no
    // iPhone. Ela fica em branco por um instante e recebe a URL no fim.
    const tab = window.open("", "_blank");

    setPending(true);
    try {
      const result = await createWhatsAppOrderAction({
        items,
        couponCode: couponDropped ? null : couponCode,
        customerName,
      });

      if (!result.ok) {
        tab?.close();
        // The coupon stopped applying: off it comes, the dialog shows the
        // new total, and the shopper decides whether to go on.
        if (result.couponRejected) {
          setCouponCode(null);
          setCouponDropped({ message: result.message, total: result.totalWithoutCoupon ?? null });
          return;
        }
        toast.error(result.message);
        return;
      }

      setOpen(false);
      if (result.adjusted) {
        toast.warning("Alguns itens foram ajustados", {
          // Duas causas caem aqui — estoque menor do que o pedido, e
          // linha da sacola que o site não conseguiu ler — e a saída é a
          // mesma nas duas: conferir a lista que foi de fato registrada.
          description: "Confira a lista na mensagem antes de enviar.",
        });
      }

      toast.success(`Pedido #${result.code} criado`, {
        description: "Mande a mensagem que abrimos para a loja confirmar sua compra.",
      });

      if (tab && !tab.closed) {
        tab.location.href = result.url;
      } else {
        // Pop-up bloqueado mesmo assim: o pedido existe e o código já foi
        // dado ao cliente, então levar a aba atual ao WhatsApp é melhor
        // do que deixá-lo com um código e nenhuma conversa.
        window.location.href = result.url;
      }
    } catch (error) {
      tab?.close();
      // Sem isto a causa sumia: uma falha de rede, ou um id de Server
      // Action que envelheceu depois de um deploy/hot-reload (o navegador
      // segue com o bundle antigo), chegava aqui como a *mesma* frase que
      // uma recusa do banco — impossível saber qual dos dois aconteceu.
      console.error("[WhatsAppBuyButton] createWhatsAppOrderAction falhou", error);
      toast.error("Não consegui falar com a loja", {
        description:
          "Confira sua conexão e recarregue a página antes de tentar de novo.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={appearance === "buy" ? "default" : "outline"}
        onClick={handleOpen}
        disabled={disabled || pending}
        className={`w-full ${
          appearance === "buy"
            ? "bg-buy text-white hover:bg-buy-hover"
            : "border-[#25D366] text-[#0E7A3E] hover:bg-[#25D366]/10 hover:text-[#0E7A3E]"
        } ${className}`}
      >
        <WhatsAppIcon className="size-5" />
        {pending ? "Gerando pedido…" : label}
      </Button>

      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="storefront-theme bg-white text-fg sm:max-w-md">
          <form onSubmit={handleSend} className="flex flex-col gap-5">
            <DialogHeader>
              <DialogTitle>Finalizar pelo WhatsApp</DialogTitle>
              <DialogDescription>
                Geramos o código do seu pedido e abrimos o WhatsApp com a
                mensagem pronta. A loja confirma a compra e combina frete e
                pagamento com você.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <Label htmlFor="whatsapp-customer-name">Seu nome</Label>
              <Input
                id="whatsapp-customer-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (nameError) setNameError(null);
                }}
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="send"
                maxLength={80}
                autoFocus
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? "whatsapp-customer-name-error" : undefined}
              />
              {nameError && (
                <p id="whatsapp-customer-name-error" role="alert" className="text-xs font-medium text-alert">
                  {nameError}
                </p>
              )}
            </div>

            {couponDropped && (
              <div role="alert" className="rounded-md border border-alert/30 bg-alert/5 p-3 text-sm">
                <p className="font-medium text-alert">{couponDropped.message}</p>
                {couponDropped.total !== null && (
                  <p className="mt-1 text-fg">
                    Total dos produtos sem o cupom:{" "}
                    <strong>{formatCurrency(couponDropped.total)}</strong>
                  </p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                type="submit"
                size="lg"
                disabled={pending}
                className="w-full bg-[#1FAF55] text-white hover:bg-[#1A9A4B]"
              >
                <WhatsAppIcon className="size-5" />
                {pending
                  ? "Gerando pedido…"
                  : couponDropped
                    ? "Continuar sem o cupom"
                    : "Enviar pedido pelo WhatsApp"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
