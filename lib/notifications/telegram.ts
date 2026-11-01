import "server-only";

/**
 * Manda uma mensagem para o Telegram da loja.
 *
 * Configuração (secrets do Worker na Cloudflare):
 *   TELEGRAM_BOT_TOKEN — o token que o @BotFather entrega ao criar o bot
 *   TELEGRAM_CHAT_ID   — o chat (ou grupo) que recebe os avisos
 *
 * Sem as duas, não faz nada: o pedido segue normal, só sem aviso. Uma
 * falha aqui nunca derruba a baixa do pagamento — só fica no log.
 */
export async function sendTelegramMessage(html: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatIds = (process.env.TELEGRAM_CHAT_ID ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!token || chatIds.length === 0) return false;

  let ok = true;
  for (const chatId of chatIds) {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: html,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        },
      );
      if (!response.ok) {
        ok = false;
        console.error(
          "[telegram]",
          response.status,
          await response.text().catch(() => ""),
        );
      }
    } catch (error) {
      ok = false;
      console.error("[telegram]", error);
    }
  }
  return ok;
}
