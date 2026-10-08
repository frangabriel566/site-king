import "server-only";
import { formatCurrency } from "@/lib/format";
import { getStoreWhatsAppNumber } from "@/lib/whatsapp/order-link";
import { orderSummaryText } from "@/lib/orders/summary";
import type { PaymentInitResult, PaymentOrderInput, PaymentProvider } from "./types";

export class WhatsAppProvider implements PaymentProvider {
  async createPayment(input: PaymentOrderInput): Promise<PaymentInitResult> {
    const phone = await getStoreWhatsAppNumber();

    if (!phone) {
      throw new Error("Nenhum número de WhatsApp configurado.");
    }

    const lines = [
      `Olá! Quero pagar o pedido *#${input.orderNumber}* da King Store.`,
      "",
      ...input.items.map(
        (item) => `• ${item.qty}x ${item.name} — ${formatCurrency(item.unitPrice * item.qty)}`,
      ),
      "",
      // The same lines as the bag and the WhatsApp order (lib/orders/summary.ts).
      ...orderSummaryText({
        subtotal: input.subtotal,
        itemCount: input.items.reduce((sum, item) => sum + item.qty, 0),
        discount: input.discount,
        couponCode: input.couponCode,
        shippingMode: input.shippingMode,
        shipping: input.shipping,
        total: input.total,
      }),
      `Nome: ${input.customerName}`,
    ];

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
    return { kind: "whatsapp", url };
  }
}
