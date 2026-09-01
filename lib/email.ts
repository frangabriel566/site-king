import "server-only";
import { Resend } from "resend";
import { formatCurrency } from "@/lib/format";

export type OrderConfirmationEmailInput = {
  to: string;
  customerName: string;
  orderNumber: number;
  total: number;
  items: { name: string; color: string; size: string; qty: number; unitPrice: number }[];
};

export async function sendOrderConfirmationEmail(
  input: OrderConfirmationEmailInput,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // No e-mail provider configured — the order still succeeds without one.
    return;
  }

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL ?? "King Store <pedidos@kingstore.com.br>";

  const itemsHtml = input.items
    .map(
      (item) =>
        `<tr><td style="padding:8px 0;">${item.qty}x ${item.name} (${item.color}, ${item.size})</td><td style="padding:8px 0;text-align:right;">${formatCurrency(item.unitPrice * item.qty)}</td></tr>`,
    )
    .join("");

  try {
    await resend.emails.send({
      from,
      to: input.to,
      subject: `Pedido #${input.orderNumber} confirmado — King Store`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#0A0A0A;">
          <h1 style="font-size:20px;letter-spacing:-0.02em;text-transform:uppercase;">King Store</h1>
          <p>Olá, ${input.customerName}. Seu pagamento foi confirmado.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">${itemsHtml}</table>
          <p style="font-weight:bold;">Total: ${formatCurrency(input.total)}</p>
          <p style="color:#8A8A8A;font-size:12px;">Pedido #${input.orderNumber}</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("[sendOrderConfirmationEmail]", error);
  }
}
