"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/shop/whatsapp-icon";
import { createWhatsAppOrderAction } from "@/lib/actions/whatsapp-orders";

export type WhatsAppBuyItem = { variantId: string; qty: number };

/**
 * "Comprar pelo WhatsApp" — o pedido é gravado antes de a conversa
 * abrir, com código próprio, e é isso que diferencia este botão de um
 * link `wa.me` qualquer: os dois lados passam a falar do mesmo pedido.
 *
 * `getItems` devolve `null` quando quem chama ainda não tem uma escolha
 * válida (a página de produto sem tamanho selecionado, por exemplo) —
 * ela já mostrou o próprio erro nesse caso, então aqui é só parar.
 */
export function WhatsAppBuyButton({
  getItems,
  label = "Comprar pelo WhatsApp",
  disabled = false,
  className = "",
  size = "xl",
}: {
  getItems: () => WhatsAppBuyItem[] | null;
  label?: string;
  disabled?: boolean;
  className?: string;
  size?: "lg" | "xl";
}) {
  // `useState` e não `useTransition`: a ação termina abrindo outra aba,
  // e o pending de uma transition continua preso ao render do React
  // depois que o foco já saiu da página.
  const [pending, setPending] = useState(false);

  async function handleClick() {
    const items = getItems();
    if (!items || items.length === 0) return;

    // A aba tem de ser aberta **dentro** do gesto do clique. Abrir depois
    // do `await` é o que o bloqueador de pop-up de todo navegador móvel
    // recusa, e era assim que o botão simplesmente não fazia nada no
    // iPhone. Ela fica em branco por um instante e recebe a URL no fim.
    const tab = window.open("", "_blank");

    setPending(true);
    try {
      const result = await createWhatsAppOrderAction({ items });

      if (!result.ok) {
        tab?.close();
        toast.error(result.message);
        return;
      }

      if (result.adjusted) {
        toast.warning("Alguns itens foram ajustados", {
          description:
            "A quantidade de alguma peça mudou por causa do estoque. Confira a lista na mensagem.",
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
    } catch {
      tab?.close();
      toast.error("Não foi possível gerar seu pedido. Tente de novo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      size={size}
      variant="outline"
      onClick={handleClick}
      disabled={disabled || pending}
      className={`w-full border-[#25D366] text-[#128C4A] hover:bg-[#25D366]/10 hover:text-[#128C4A] ${className}`}
    >
      <WhatsAppIcon className="size-5" />
      {pending ? "Gerando pedido…" : label}
    </Button>
  );
}
