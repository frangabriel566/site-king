import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrderByIdAdmin } from "@/lib/data/orders";
import { formatCurrency, formatDateTime, formatVariantLabel } from "@/lib/format";
import { OrderStatusForm } from "./order-status-form";
import { ShippingLabel } from "./shipping-label";

export const metadata: Metadata = { title: "Pedido — Painel" };

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderByIdAdmin(id);
  if (!order) notFound();

  const snapshot = order.customer_snapshot as {
    name?: string;
    email?: string;
    phone?: string;
  } | null;
  const address = order.shipping_address as {
    street?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: string;
    state?: string;
    cep?: string;
  } | null;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-label mb-2">Pedidos</p>
          <h1 className="text-heading text-3xl">Pedido #{order.code ?? order.order_number}</h1>
          <p className="mt-2 text-sm text-ink-muted">{formatDateTime(order.created_at)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-8">
          <div>
            <p className="text-label mb-3">Itens</p>
            <div className="rounded-lg border border-line bg-card">
              <table className="w-full text-sm">
                <tbody>
                  {order.order_items.map((item) => (
                    <tr key={item.id} className="border-b border-line last:border-0">
                      <td className="p-3">
                        {item.name}
                        <span className="block text-xs text-ink-muted">
                          {[formatVariantLabel(item.color, item.size), `Qtd. ${item.qty}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {formatCurrency(item.unit_price * item.qty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-muted">Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Frete</span>
                <span>{formatCurrency(order.shipping)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-ink-muted">Desconto</span>
                  <span>-{formatCurrency(order.discount)}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between border-t border-line pt-1 font-medium">
                <span>Total</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div>
              <p className="text-label mb-3">Cliente</p>
              <p className="text-sm">{snapshot?.name ?? "—"}</p>
              <p className="text-sm text-ink-muted">{snapshot?.email ?? "—"}</p>
              <p className="text-sm text-ink-muted">{snapshot?.phone ?? "—"}</p>
            </div>
            {address && (
              <div>
                <p className="text-label mb-3">Endereço de entrega</p>
                <p className="text-sm text-ink-muted">
                  {address.street}, {address.number}
                  {address.complement ? ` — ${address.complement}` : ""}
                  <br />
                  {address.district}, {address.city} — {address.state}
                  <br />
                  {address.cep}
                </p>
              </div>
            )}
          </div>

          <div>
            <p className="text-label mb-3">Pagamento</p>
            <p className="text-sm text-ink-muted">
              {order.payment_method ?? "—"}
              {order.payment_id ? ` · ID ${order.payment_id}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {order.status === "aguardando_whatsapp" ? (
            // O formulário genérico levaria este pedido a "Pago" por
            // fulfill_order_stock(), que ignora em silêncio uma variação
            // sem saldo. Enquanto a venda não está fechada, a única porta
            // é a aba de WhatsApp, onde a baixa é transacional e recusa o
            // pedido inteiro se faltar uma peça.
            <div className="rounded-lg border border-line bg-card p-5 print:hidden">
              <p className="text-label mb-2">Aguardando WhatsApp</p>
              <p className="text-sm text-ink-muted">
                Código <strong className="text-fg">#{order.code}</strong>. Confirme
                ou cancele esta venda em{" "}
                <Link
                  href="/admin/pedidos-whatsapp"
                  className="text-accent-light hover:underline"
                >
                  Pedidos WhatsApp
                </Link>
                {order.expires_at
                  ? ` — ela expira em ${formatDateTime(order.expires_at)}.`
                  : "."}
              </p>
            </div>
          ) : (
            <OrderStatusForm
              orderId={order.id}
              currentStatus={order.status}
              currentTrackingCode={order.tracking_code}
            />
          )}
          <ShippingLabel
            orderId={order.id}
            initial={
              order.melhorenvio_order_id
                ? {
                    melhorenvioOrderId: order.melhorenvio_order_id,
                    labelUrl: order.label_url,
                    trackingCode: order.tracking_code,
                  }
                : null
            }
          />
        </div>
      </div>
    </div>
  );
}
