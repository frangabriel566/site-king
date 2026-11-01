import type { Metadata } from "next";
import Link from "next/link";
import { getAllOrdersAdmin, getOrderItemPhotos } from "@/lib/data/orders";
import { ORDER_STATUS_LABEL } from "@/lib/constants";
import { formatCurrency, formatDateTime, formatVariantLabel } from "@/lib/format";
import { StatusBadge, ORDER_STATUS_TONE } from "@/components/admin/status-badge";
import { OrderItemThumb } from "@/components/admin/order-item-thumb";
import { OrdersFilterBar } from "./orders-filter-bar";

export const metadata: Metadata = { title: "Pedidos — Painel" };

/**
 * Cada pedido já mostra as peças — foto, cor, tamanho e quantidade — para
 * separar a mercadoria direto daqui, sem abrir pedido por pedido.
 */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; busca?: string }>;
}) {
  const { status, busca } = await searchParams;
  const orders = await getAllOrdersAdmin({ status, search: busca });
  const photos = await getOrderItemPhotos(orders.flatMap((order) => order.order_items));

  return (
    <div>
      <div className="mb-8">
        <p className="text-label mb-2">Painel</p>
        <h1 className="text-heading text-3xl">Pedidos</h1>
      </div>

      <OrdersFilterBar status={status} search={busca} />

      {orders.length === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">Nenhum pedido encontrado.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {orders.map((order) => {
            const snapshot = order.customer_snapshot as { name?: string } | null;
            const units = order.order_items.reduce((sum, item) => sum + item.qty, 0);
            return (
              <li key={order.id} className="rounded-lg border border-line bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link
                      href={`/admin/pedidos/${order.id}`}
                      className="font-medium hover:text-accent-light"
                    >
                      #{order.code ?? order.order_number}
                    </Link>
                    <StatusBadge tone={ORDER_STATUS_TONE[order.status]}>
                      {ORDER_STATUS_LABEL[order.status] ?? order.status}
                    </StatusBadge>
                  </div>
                  <span className="font-medium">{formatCurrency(order.total)}</span>
                </div>

                <div className="px-4 py-3">
                  <p className="mb-3 text-xs text-ink-muted">
                    {formatDateTime(order.created_at)} · {snapshot?.name ?? "—"} · {units}{" "}
                    {units === 1 ? "peça" : "peças"}
                  </p>
                  <ul className="flex flex-col gap-3">
                    {order.order_items.map((item) => {
                      const variant = formatVariantLabel(item.color, item.size);
                      return (
                        <li key={item.id} className="flex items-center gap-3">
                          <OrderItemThumb url={photos.get(item.id)} alt={item.name} size={44} />
                          <div className="min-w-0 flex-1 text-sm">
                            <p className="truncate">{item.name}</p>
                            <p className="text-xs text-ink-muted">
                              {[variant, `Qtd. ${item.qty}`].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="flex gap-4 border-t border-line px-4 py-2 text-sm">
                  <Link
                    href={`/admin/pedidos/${order.id}`}
                    className="text-accent-light hover:underline"
                  >
                    Abrir
                  </Link>
                  <Link
                    href={`/admin/imprimir/pedido/${order.id}`}
                    target="_blank"
                    className="text-accent-light hover:underline"
                  >
                    Imprimir
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
