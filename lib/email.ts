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

/**
 * "Esqueci minha senha". Called by Better Auth (lib/auth/server.ts) with the
 * one-hour link it generated.
 *
 * Without RESEND_API_KEY nothing is sent and the shopper still sees the
 * neutral "se o e-mail existir…" message — the flow is wired and starts
 * working the moment the key is configured. In `next dev` the link is
 * printed to the terminal instead, so the flow can be tested locally.
 */
export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  url: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[sendPasswordResetEmail] RESEND_API_KEY ausente — e-mail não enviado.");
    if (process.env.NODE_ENV === "development") {
      console.info(`[sendPasswordResetEmail] link para ${input.to}: ${input.url}`);
    }
    return;
  }

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL ?? "King Store <pedidos@kingstore.com.br>";
  const firstName = input.name.split(" ")[0] || "cliente";

  try {
    await resend.emails.send({
      from,
      to: input.to,
      subject: "Redefinir sua senha — King Store",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#0A0A0A;">
          <h1 style="font-size:20px;letter-spacing:-0.02em;text-transform:uppercase;">King Store</h1>
          <p>Olá, ${firstName}. Recebemos um pedido para redefinir a senha da sua conta.</p>
          <p style="margin:24px 0;">
            <a href="${input.url}" style="background:#0A0A0A;color:#FFFFFF;padding:12px 20px;text-decoration:none;font-weight:bold;">Criar nova senha</a>
          </p>
          <p style="color:#8A8A8A;font-size:12px;">O link vale por 1 hora. Se não foi você, ignore este e-mail — sua senha continua a mesma.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("[sendPasswordResetEmail]", error);
  }
}
