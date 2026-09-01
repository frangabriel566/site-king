import type { Metadata } from "next";
import Link from "next/link";
import { getAllOrdersAdmin } from "@/lib/data/orders";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrdersFilterBar } from "./orders-filter-bar";

export const metadata: Metadata = { title: "Pedidos — Painel" };

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando pagamento",
  paid: "Pago",
  processing: "Em preparação",
  shipped: "Enviado",
  delivered: "Entregue",
  canceled: "Cancelado",
};

const STATUS_VARIANT: Record<string, "default" | "outline"> = {
  paid: "default",
  delivered: "default",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; busca?: string }>;
}) {
  const { status, busca } = await searchParams;
  const orders = await getAllOrdersAdmin({ status, search: busca });

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
        <Table className="mt-6">
          <TableHeader>
            <TableRow className="border-line hover:bg-transparent">
              <TableHead>Pedido</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const snapshot = order.customer_snapshot as { name?: string } | null;
              return (
                <TableRow key={order.id} className="border-line">
                  <TableCell>
                    <Link href={`/admin/pedidos/${order.id}`} className="hover:text-gold">
                      #{order.order_number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-ink-muted">
                    {formatDateTime(order.created_at)}
                  </TableCell>
                  <TableCell className="text-ink-muted">
                    {snapshot?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={STATUS_VARIANT[order.status] ?? "outline"}
                      className="rounded-none"
                    >
                      {STATUS_LABEL[order.status] ?? order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(order.total)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
