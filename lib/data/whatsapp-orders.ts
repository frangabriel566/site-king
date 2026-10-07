import "server-only";
import { and, count, desc, eq, inArray, isNotNull, like, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { OrderItem } from "@/lib/data/orders";
import {
  WHATSAPP_ORDER_FILTERS,
  type WhatsAppOrderFilter,
} from "@/lib/constants";
import type { OrderStatus, Tables } from "@/lib/database.types";
import { requireAdminPage } from "@/lib/auth/guards";
import { expireWhatsAppOrders } from "@/lib/orders/whatsapp";

export type WhatsAppOrder = Tables<"orders"> & { order_items: OrderItem[] };

const { orders } = schema;

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
  await requireAdminPage();

  // A varredura das 48h roda aqui, ao abrir a aba: não há cron neste
  // projeto, e esta é exatamente a hora em que a lista precisa estar
  // correta. Falhar nela não pode derrubar a página — o pior caso é um
  // pedido vencido ainda aparecendo como pendente, e o botão Confirmar
  // recusa esse pedido de qualquer jeito.
  try {
    await expireWhatsAppOrders();
  } catch (error) {
    console.error("[getWhatsAppOrdersAdmin] varredura de expiração falhou", error);
  }

  const conditions: SQL[] = [isNotNull(orders.code)];
  const term = search?.trim().replace(/^#/, "") ?? "";

  if (term) {
    // Buscar por código ignora o filtro de status de propósito. O
    // atendente digita o código que o cliente mandou no WhatsApp para
    // achar *aquele* pedido — devolver "nenhum resultado" só porque ele
    // já foi confirmado, e a aba estava em "Aguardando", seria esconder
    // exatamente a resposta que foi pedida. LIKE (que no SQLite ignora
    // maiúsculas em ASCII) porque "#KS0007" costuma vir colado com o "#",
    // e "ks7" digitado com pressa ainda encontra.
    conditions.push(like(orders.code, `%${term}%`));
  } else {
    const statuses = WHATSAPP_ORDER_FILTERS[filter].statuses as readonly OrderStatus[];
    if (statuses.length > 0) conditions.push(inArray(orders.status, [...statuses]));
  }

  return getDb().query.orders.findMany({
    where: and(...conditions),
    orderBy: desc(orders.created_at),
    limit: 200,
    with: { order_items: true },
  });
}

/** Para o selo de contagem na barra da aba. */
export async function countPendingWhatsAppOrders(): Promise<number> {
  await requireAdminPage();
  const [{ value }] = await getDb()
    .select({ value: count() })
    .from(orders)
    .where(eq(orders.status, "aguardando_whatsapp"));
  return value;
}
