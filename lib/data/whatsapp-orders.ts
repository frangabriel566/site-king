import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { OrderItem } from "@/lib/data/orders";
import {
  WHATSAPP_ORDER_FILTERS,
  type WhatsAppOrderFilter,
} from "@/lib/constants";
import type { Tables } from "@/lib/database.types";

export type WhatsAppOrder = Tables<"orders"> & { order_items: OrderItem[] };

/**
 * Tudo que nasceu da compra direta pelo WhatsApp.
 *
 * O recorte é `code is not null`, não o status: assim que o admin
 * confirma, o pedido vira um `paid` normal e some de qualquer filtro por
 * status — mas continua sendo o pedido daquele código, e o atendente
 * precisa reencontrá-lo pelo número que o cliente tem no celular.
 */
export async function getWhatsAppOrdersAdmin({
  filter = "pendentes",
  search,
}: {
  filter?: WhatsAppOrderFilter;
  search?: string;
} = {}): Promise<WhatsAppOrder[]> {
  const supabase = await createClient();

  // A varredura das 48h roda aqui, ao abrir a aba: não há cron neste
  // projeto, e esta é exatamente a hora em que a lista precisa estar
  // correta. Falhar nela não pode derrubar a página — o pior caso é um
  // pedido vencido ainda aparecendo como pendente, e o botão Confirmar
  // recusa esse pedido de qualquer jeito.
  const { error: sweepError } = await supabase.rpc("expire_whatsapp_orders");
  if (sweepError) {
    console.error("[getWhatsAppOrdersAdmin] expire_whatsapp_orders falhou", sweepError);
  }

  let query = supabase
    .from("orders")
    .select("*, order_items(*)")
    .not("code", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

  const term = search?.trim().replace(/^#/, "") ?? "";

  if (term) {
    // Buscar por código ignora o filtro de status de propósito. O
    // atendente digita o código que o cliente mandou no WhatsApp para
    // achar *aquele* pedido — devolver "nenhum resultado" só porque ele
    // já foi confirmado, e a aba estava em "Aguardando", seria esconder
    // exatamente a resposta que foi pedida.
    // `ilike` porque "#KS0007" costuma vir colado com o "#", e "ks7"
    // digitado com pressa ainda encontra.
    query = query.ilike("code", `%${term}%`);
  } else {
    const statuses = WHATSAPP_ORDER_FILTERS[filter].statuses;
    if (statuses.length > 0) {
      query = query.in("status", statuses);
    }
  }

  const { data } = await query;
  return (data ?? []) as WhatsAppOrder[];
}

/** Para o selo de contagem na barra da aba. */
export async function countPendingWhatsAppOrders(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "aguardando_whatsapp");

  return count ?? 0;
}
