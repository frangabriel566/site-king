"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import { getSiteSettings } from "@/lib/data/settings";
import { getRequestOrigin } from "@/lib/site-url";
import {
  WhatsAppOrderError,
  cancelWhatsAppOrder,
  confirmWhatsAppOrder,
  createWhatsAppOrder,
  type WhatsAppOrderErrorCode,
} from "@/lib/orders/whatsapp";
import {
  buildWhatsAppOrderLink,
  buildWhatsAppOrderMessage,
  getStoreWhatsAppNumber,
  type WhatsAppOrderItem,
} from "@/lib/whatsapp/order-link";
import {
  parseWhatsAppItems,
  whatsappOrderIdSchema,
} from "@/lib/validations/whatsapp-order";

export type CreateWhatsAppOrderResult =
  | {
      ok: true;
      /** O wa.me já montado — o cliente só precisa abrir. */
      url: string;
      code: string;
      orderId: string;
      /** Algum item caiu ou teve a quantidade aparada ao estoque. O
       *  pedido vale, mas a vitrine precisa dizer isso em voz alta. */
      adjusted: boolean;
    }
  | { ok: false; message: string };

// As regras vivem em lib/orders/whatsapp.ts; o português da vitrine,
// aqui.
const CREATE_ERRORS: Partial<Record<WhatsAppOrderErrorCode, string>> = {
  EMPTY_CART: "Sua sacola está vazia.",
  TOO_MANY_ITEMS: "Sacola grande demais para um pedido só. Divida em dois.",
  NO_AVAILABLE_ITEMS:
    "Nenhum item da sua sacola está disponível agora. Confira o estoque e tente de novo.",
};

/**
 * Cria o pedido "aguardando_whatsapp" e devolve o link da conversa.
 *
 * A ordem aqui é deliberada: o número da loja é conferido **antes** de
 * gravar qualquer coisa. Criar o pedido primeiro e só então descobrir
 * que não há para onde mandar o cliente deixaria um código órfão na aba
 * do painel a cada clique.
 */
export async function createWhatsAppOrderAction(
  input: unknown,
): Promise<CreateWhatsAppOrderResult> {
  const { items: requested, dropped } = parseWhatsAppItems(input);
  if (requested.length === 0) {
    return {
      ok: false,
      message:
        "Não consegui ler os itens da sua sacola. Remova as peças, adicione de novo e tente outra vez.",
    };
  }

  const phone = await getStoreWhatsAppNumber();
  if (!phone) {
    return {
      ok: false,
      message: "A loja ainda não configurou um WhatsApp. Finalize pelo site.",
    };
  }

  // Cliente com sessão e cadastro completo: o pedido fica amarrado a ele.
  // Visitante: customer_id fica nulo e a identificação acontece na
  // própria conversa.
  const user = await getCurrentUser();

  let order;
  try {
    order = await createWhatsAppOrder(requested, user?.id ?? null);
  } catch (error) {
    const message =
      error instanceof WhatsAppOrderError ? CREATE_ERRORS[error.code] : undefined;
    if (!message) console.error("[createWhatsAppOrderAction]", error);
    return { ok: false, message: message ?? "Não foi possível gerar seu pedido. Tente de novo." };
  }

  const [settings, origin] = await Promise.all([getSiteSettings(), getRequestOrigin()]);

  const items: WhatsAppOrderItem[] = order.items.map((item) => ({
    name: item.name,
    slug: item.slug,
    color: item.color,
    size: item.size,
    qty: item.qty,
    unitPrice: item.unit_price,
  }));

  const message = buildWhatsAppOrderMessage({
    storeName: settings.store_name,
    code: order.code,
    items,
    total: order.total,
    expiresAt: order.expires_at,
    origin,
  });

  // Sem revalidatePath aqui de propósito: quem precisa ver este pedido é
  // o painel, que roda noutra sessão e noutro navegador, e cujas rotas
  // são dinâmicas de qualquer forma. Invalidar cache a partir do
  // navegador do cliente não alcançaria o atendente.
  return {
    ok: true,
    url: buildWhatsAppOrderLink(phone, message),
    code: order.code,
    orderId: order.order_id,
    // Os dois lados do ajuste: linha aparada por estoque, e linha que nem
    // chegou lá porque veio ilegível do localStorage.
    adjusted: order.adjusted || dropped,
  };
}

export type WhatsAppAdminResult = { ok: boolean; message?: string };

function revalidateWhatsAppOrders(orderId: string) {
  revalidatePath("/admin/pedidos-whatsapp");
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin/estoque");
  revalidatePath("/admin");
}

const ADMIN_ERRORS: Partial<Record<WhatsAppOrderErrorCode, string>> = {
  NOT_FOUND: "Pedido não encontrado.",
  NOT_PENDING: "Este pedido não está mais aguardando WhatsApp.",
  EXPIRED: "Este pedido passou das 48 horas e expirou.",
};

function translateAdminError(error: unknown): string {
  if (!(error instanceof WhatsAppOrderError)) return "Não foi possível concluir a operação.";
  // OUT_OF_STOCK carrega o nome da peça que faltou — é a informação que
  // decide o que o atendente vai responder ao cliente.
  if (error.code === "OUT_OF_STOCK") {
    return `Sem estoque suficiente de "${error.detail ?? "uma das peças"}". Nada foi baixado.`;
  }
  return ADMIN_ERRORS[error.code] ?? "Não foi possível concluir a operação.";
}

/**
 * "Confirmar venda": baixa o estoque de todas as variações e marca o
 * pedido como pago, numa transação só (lib/orders/whatsapp.ts). Se faltar
 * saldo, nenhuma variação é decrementada.
 */
export async function confirmWhatsAppOrderAction(
  input: unknown,
): Promise<WhatsAppAdminResult> {
  const parsed = whatsappOrderIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pedido inválido." };

  await requireAdmin();
  try {
    await confirmWhatsAppOrder(parsed.data.order_id);
  } catch (error) {
    if (!(error instanceof WhatsAppOrderError)) console.error("[confirmWhatsAppOrderAction]", error);
    // Mesmo falhando, a lista pode estar desatualizada (um pedido que
    // expirou entre o carregamento da página e o clique), então revalida.
    revalidateWhatsAppOrders(parsed.data.order_id);
    return { ok: false, message: translateAdminError(error) };
  }

  revalidateWhatsAppOrders(parsed.data.order_id);
  return { ok: true };
}

export async function cancelWhatsAppOrderAction(
  input: unknown,
): Promise<WhatsAppAdminResult> {
  const parsed = whatsappOrderIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pedido inválido." };

  await requireAdmin();
  try {
    await cancelWhatsAppOrder(parsed.data.order_id);
  } catch (error) {
    if (!(error instanceof WhatsAppOrderError)) console.error("[cancelWhatsAppOrderAction]", error);
    revalidateWhatsAppOrders(parsed.data.order_id);
    return { ok: false, message: translateAdminError(error) };
  }

  revalidateWhatsAppOrders(parsed.data.order_id);
  return { ok: true };
}
