"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSiteSettings } from "@/lib/data/settings";
import { getRequestOrigin } from "@/lib/site-url";
import {
  buildWhatsAppOrderLink,
  buildWhatsAppOrderMessage,
  getStoreWhatsAppNumber,
  type WhatsAppOrderItem,
} from "@/lib/whatsapp/order-link";
import {
  whatsappOrderIdSchema,
  whatsappOrderSchema,
} from "@/lib/validations/whatsapp-order";
import { requireAdmin } from "./require-admin";

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

/** O payload de create_whatsapp_order(). */
type CreatedOrder = {
  order_id: string;
  code: string;
  expires_at: string | null;
  total: number;
  items: {
    name: string;
    slug: string;
    color: string | null;
    size: string | null;
    qty: number;
    unit_price: number;
  }[];
  adjusted: boolean;
};

// As exceções que a função do banco levanta. Traduzidas aqui, e não no
// SQL, porque é no banco que a regra vive e aqui que o português da
// vitrine vive.
const CREATE_ERRORS: Record<string, string> = {
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
  const parsed = whatsappOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Sacola inválida." };
  }

  const phone = await getStoreWhatsAppNumber();
  if (!phone) {
    return {
      ok: false,
      message: "A loja ainda não configurou um WhatsApp. Finalize pelo site.",
    };
  }

  // Cliente com sessão: create_whatsapp_order lê auth.uid() lá dentro e
  // amarra o pedido ao cadastro. Visitante: customer_id fica nulo e a
  // identificação acontece na própria conversa.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_whatsapp_order", {
    p_items: parsed.data.items.map((item) => ({
      variant_id: item.variantId,
      qty: item.qty,
    })),
  });

  if (error || !data) {
    const key = Object.keys(CREATE_ERRORS).find((name) =>
      error?.message?.includes(name),
    );
    if (!key) console.error("[createWhatsAppOrderAction]", error);
    return {
      ok: false,
      message: key
        ? CREATE_ERRORS[key]
        : "Não foi possível gerar seu pedido. Tente de novo.",
    };
  }

  const order = data as unknown as CreatedOrder;
  const [settings, origin] = await Promise.all([getSiteSettings(), getRequestOrigin()]);

  const items: WhatsAppOrderItem[] = order.items.map((item) => ({
    name: item.name,
    slug: item.slug,
    color: item.color,
    size: item.size,
    qty: item.qty,
    unitPrice: Number(item.unit_price),
  }));

  const message = buildWhatsAppOrderMessage({
    storeName: settings.store_name,
    code: order.code,
    items,
    total: Number(order.total),
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
    adjusted: Boolean(order.adjusted),
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

const ADMIN_ERRORS: Record<string, string> = {
  NOT_FOUND: "Pedido não encontrado.",
  NOT_PENDING: "Este pedido não está mais aguardando WhatsApp.",
  EXPIRED: "Este pedido passou das 48 horas e expirou.",
  FORBIDDEN: "Apenas administradores podem alterar pedidos.",
};

function translateAdminError(message: string | undefined): string {
  // OUT_OF_STOCK carrega o nome da peça que faltou — é a informação que
  // decide o que o atendente vai responder ao cliente, então ela chega
  // inteira à tela em vez de virar um "erro ao confirmar".
  // `[\s\S]` e não a flag `s`: o target do projeto é ES2017, onde
  // `dotAll` ainda não existe.
  const outOfStock = message?.match(/OUT_OF_STOCK:([\s\S]*?)(?:\s*CONTEXT:|$)/);
  if (outOfStock) {
    return `Sem estoque suficiente de "${outOfStock[1].trim()}". Nada foi baixado.`;
  }

  const key = Object.keys(ADMIN_ERRORS).find((name) => message?.includes(name));
  return key ? ADMIN_ERRORS[key] : "Não foi possível concluir a operação.";
}

/**
 * "Confirmar venda": baixa o estoque de todas as variações e marca o
 * pedido como pago, numa transação só (confirm_whatsapp_order).
 *
 * Nada de estoque é tocado deste lado — se a função do banco abortar por
 * falta de saldo, nenhuma variação foi decrementada.
 */
export async function confirmWhatsAppOrderAction(
  input: unknown,
): Promise<WhatsAppAdminResult> {
  const parsed = whatsappOrderIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pedido inválido." };

  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("confirm_whatsapp_order", {
    p_order_id: parsed.data.order_id,
  });

  if (error) {
    console.error("[confirmWhatsAppOrderAction]", error);
    // Mesmo falhando, a lista pode estar desatualizada (um pedido que
    // expirou entre o carregamento da página e o clique), então revalida.
    revalidateWhatsAppOrders(parsed.data.order_id);
    return { ok: false, message: translateAdminError(error.message) };
  }

  revalidateWhatsAppOrders(parsed.data.order_id);
  return { ok: true };
}

export async function cancelWhatsAppOrderAction(
  input: unknown,
): Promise<WhatsAppAdminResult> {
  const parsed = whatsappOrderIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pedido inválido." };

  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("cancel_whatsapp_order", {
    p_order_id: parsed.data.order_id,
  });

  if (error) {
    console.error("[cancelWhatsAppOrderAction]", error);
    revalidateWhatsAppOrders(parsed.data.order_id);
    return { ok: false, message: translateAdminError(error.message) };
  }

  revalidateWhatsAppOrders(parsed.data.order_id);
  return { ok: true };
}
