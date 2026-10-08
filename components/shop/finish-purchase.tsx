"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WhatsAppBuyButton, type WhatsAppBuyItem } from "@/components/shop/whatsapp-buy-button";
import { useShopConfig } from "@/components/shop/shop-config-provider";

/**
 * "Finalizar compra" for the bag and the drawer — one copy, so both close
 * the sale the same way.
 *
 * Checkout closed (lib/sales-mode.ts — today, with no online payment and
 * the freight agreed on WhatsApp): the button itself creates the WhatsApp
 * order (createWhatsAppOrder), no login and no address, and there is no
 * second WhatsApp button repeating it. Checkout open: it leads to
 * /checkout, with "Comprar pelo WhatsApp" under it as before.
 *
 * Only the pieces that exist go in (`items`), never the checkbox
 * selection: those marks are for removing lines in bulk, and nobody
 * expects unticking a piece to also take it out of the order.
 */
export function FinishPurchase({
  items,
  couponCode,
  whatsappEnabled,
  onNavigate,
  className = "",
}: {
  items: WhatsAppBuyItem[];
  /** The bag's coupon; the server decides whether it still applies. */
  couponCode: string | null;
  /** The store has a WhatsApp number (Configurações). */
  whatsappEnabled: boolean;
  /** Leaving for /checkout (the drawer closes itself). */
  onNavigate?: () => void;
  className?: string;
}) {
  const { checkoutOpen } = useShopConfig();
  const getItems = () => items.map(({ variantId, qty }) => ({ variantId, qty }));
  const note = (
    <p className="mt-2 text-center text-xs text-muted-foreground">
      Geramos um código e você combina frete e pagamento com a loja pelo WhatsApp.
    </p>
  );

  if (!checkoutOpen) {
    return (
      <div className={className}>
        <WhatsAppBuyButton
          appearance="buy"
          label="Finalizar compra"
          couponCode={couponCode}
          getItems={getItems}
        />
        {note}
      </div>
    );
  }

  return (
    <div className={className}>
      <Button
        asChild
        size="xl"
        className="w-full bg-buy text-white hover:bg-buy-hover"
        onClick={onNavigate}
      >
        <Link href="/checkout">Finalizar compra</Link>
      </Button>
      {whatsappEnabled && (
        <div className="mt-3">
          <WhatsAppBuyButton couponCode={couponCode} getItems={getItems} />
          {note}
        </div>
      )}
    </div>
  );
}
