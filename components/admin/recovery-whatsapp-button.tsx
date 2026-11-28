import { MessageCircle } from "lucide-react";
import {
  buildRecoveryLink,
  buildRecoveryMessage,
  customerWhatsAppNumber,
  isRecoverableOrder,
  type RecoveryMessageInput,
} from "@/lib/orders/recovery-message";

/**
 * Abre o WhatsApp do cliente com a mensagem de recuperação já escrita.
 * Só aparece em pedido que não fechou e que tem telefone válido; sem
 * telefone, avisa em vez de sumir, para a loja saber por que não há botão.
 */
export function RecoveryWhatsAppButton({
  phone,
  variant = "link",
  ...message
}: RecoveryMessageInput & { phone?: string | null; variant?: "link" | "block" }) {
  if (!isRecoverableOrder(message.status)) return null;

  const number = customerWhatsAppNumber(phone);
  if (!number) {
    return variant === "block" ? (
      <p className="text-xs text-ink-muted">
        Cliente sem telefone válido — não dá para chamar no WhatsApp.
      </p>
    ) : null;
  }

  const href = buildRecoveryLink(number, buildRecoveryMessage(message));

  if (variant === "block") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-md bg-[#25D366] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1ebe5b]"
      >
        <MessageCircle className="size-4" aria-hidden />
        Chamar no WhatsApp
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 font-medium text-[#1ebe5b] hover:underline"
    >
      <MessageCircle className="size-4" aria-hidden />
      Chamar no WhatsApp
    </a>
  );
}
