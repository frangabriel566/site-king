import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { getDashboardStats } from "@/lib/data/dashboard";
import { formatCurrency } from "@/lib/format";
import { SalesChart } from "@/components/admin/sales-chart";

export const metadata: Metadata = { title: "Dashboard — Painel" };

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando pagamento",
  paid: "Pago",
  processing: "Em preparação",
  shipped: "Enviado",
  delivered: "Entregue",
  canceled: "Cancelado",
};

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div>
      <p className="text-label mb-2">Painel</p>
      <h1 className="text-heading mb-8 text-3xl">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="border border-line p-5">
          <p className="text-label mb-2">Vendas hoje</p>
          <p className="text-2xl">{formatCurrency(stats.salesToday)}</p>
        </div>
        <div className="border border-line p-5">
          <p className="text-label mb-2">Vendas no mês</p>
          <p className="text-2xl">{formatCurrency(stats.salesMonth)}</p>
        </div>
        <div className="border border-line p-5">
          <p className="text-label mb-2">Ticket médio</p>
          <p className="text-2xl">{formatCurrency(stats.averageTicket)}</p>
        </div>
        <div className="border border-line p-5">
          <p className="text-label mb-2 flex items-center gap-2">
            Estoque baixo
            {stats.lowStockCount > 0 && (
              <AlertTriangle className="size-3.5 text-[var(--warning)]" />
            )}
          </p>
          <p className="text-2xl">{stats.lowStockCount}</p>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
        <div className="border border-line p-6">
          <p className="text-label mb-6">Vendas — últimos 30 dias</p>
          <SalesChart data={stats.dailySales} />
        </div>

        <div className="border border-line p-6">
          <p className="text-label mb-6">Pedidos por status</p>
          <ul className="flex flex-col gap-3">
            {Object.entries(STATUS_LABEL).map(([status, label]) => (
              <li key={status} className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">{label}</span>
                <span>{stats.ordersByStatus[status] ?? 0}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
