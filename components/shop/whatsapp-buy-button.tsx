"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/shop/whatsapp-icon";
import { createWhatsAppOrderAction } from "@/lib/actions/whatsapp-orders";
import { useCart } from "@/lib/cart/context";

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
  couponCode = null,
  label = "Comprar pelo WhatsApp",
  appearance = "whatsapp",
  disabled = false,
  className = "",
  size = "xl",
}: {
  getItems: () => WhatsAppBuyItem[] | null;
  /** The bag's coupon (bag and drawer only — buying one piece straight
   * from the product page is not the bag the coupon was applied to). */
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
  const { setCouponCode } = useCart();

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
      const result = await createWhatsAppOrderAction({ items, couponCode });

      if (!result.ok) {
        tab?.close();
        // The coupon stopped applying: off it comes, and the shopper sees
        // the new total before trying again.
        if (result.couponRejected) setCouponCode(null);
        toast.error(result.message);
        return;
      }

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
    <Button
      type="button"
      size={size}
      variant={appearance === "buy" ? "default" : "outline"}
      onClick={handleClick}
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
  );
}
