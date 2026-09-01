import "server-only";
import { formatCurrency } from "@/lib/format";
import { createPublicClient } from "@/lib/supabase/public";
import type { PaymentInitResult, PaymentOrderInput, PaymentProvider } from "./types";

export class WhatsAppProvider implements PaymentProvider {
  async createPayment(input: PaymentOrderInput): Promise<PaymentInitResult> {
    const supabase = createPublicClient();
    const { data: settings } = await supabase
      .from("site_settings")
      .select("whatsapp")
      .eq("id", 1)
      .maybeSingle();

    const phone = (settings?.whatsapp ?? process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(
      /\D/g,
      "",
    );

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
      `Total: ${formatCurrency(input.total)}`,
      `Nome: ${input.customerName}`,
    ];

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
    return { kind: "whatsapp", url };
  }
}
