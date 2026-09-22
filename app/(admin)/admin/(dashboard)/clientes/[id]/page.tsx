import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerByIdAdmin } from "@/lib/data/customers";
import { getOrdersByCustomerAdmin } from "@/lib/data/orders";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { StatusBadge, ORDER_STATUS_TONE } from "@/components/admin/status-badge";

export const metadata: Metadata = { title: "Cliente — Painel" };

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando pagamento",
  paid: "Pago",
  processing: "Em preparação",
  shipped: "Enviado",
  delivered: "Entregue",
  canceled: "Cancelado",
};

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomerByIdAdmin(id);
  if (!customer) notFound();

  const orders = await getOrdersByCustomerAdmin(id);
  const totalSpent = orders
    .filter((o) => o.status !== "canceled" && o.status !== "pending")
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <div>
      <p className="text-label mb-2">Clientes</p>
      <h1 className="text-heading mb-2 text-3xl">{customer.name}</h1>
      <p className="mb-8 text-sm text-ink-muted">
        {customer.email} · {customer.phone} · Cliente desde {formatDate(customer.created_at)}
      </p>

      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-card p-4 md:p-5">
          <p className="text-label mb-2">Pedidos</p>
          <p className="text-xl md:text-2xl">{orders.length}</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-4 md:p-5">
          <p className="text-label mb-2">Total gasto</p>
          <p className="text-xl md:text-2xl">{formatCurrency(totalSpent)}</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-4 md:p-5">
          <p className="text-label mb-2">Nascimento</p>
          <p className="text-xl md:text-2xl">{formatDate(customer.birthdate)}</p>
        </div>
      </div>

      <p className="text-label mb-4">Histórico de pedidos</p>
      {orders.length === 0 ? (
        <p className="text-sm text-ink-muted">Nenhum pedido ainda.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {orders.map((order) => (
            <li key={order.id} className="flex items-center justify-between py-4 text-sm">
              <Link href={`/admin/pedidos/${order.id}`} className="hover:text-accent-light">
                #{order.order_number}
              </Link>
              <span className="text-ink-muted">{formatDateTime(order.created_at)}</span>
              <StatusBadge tone={ORDER_STATUS_TONE[order.status]}>
                {STATUS_LABEL[order.status] ?? order.status}
              </StatusBadge>
              <span>{formatCurrency(order.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
