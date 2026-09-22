import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Boxes, CircleDollarSign, Receipt, TrendingUp } from "lucide-react";
import { getDashboardStats } from "@/lib/data/dashboard";
import { formatCurrency } from "@/lib/format";
import { SalesChartLazy } from "@/components/admin/sales-chart-lazy";

export const metadata: Metadata = { title: "Dashboard — Painel" };

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando pagamento",
  paid: "Pago",
  processing: "Em preparação",
  shipped: "Enviado",
  delivered: "Entregue",
  canceled: "Cancelado",
};

/** Status keeps its own meaning-colour everywhere in the panel — blue is
 * for interaction, not for "paid". The label next to each dot carries the
 * same information, so colour is never the only signal. */
const STATUS_DOT: Record<string, string> = {
  pending: "bg-[var(--warning)]",
  paid: "bg-[var(--success)]",
  processing: "bg-accent-solid",
  shipped: "bg-accent-light",
  delivered: "bg-[var(--success)]",
  canceled: "bg-[var(--danger)]",
};

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "accent",
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: "accent" | "warning";
}) {
  return (
    <div className="rounded-lg border border-line bg-card p-4 transition-colors duration-150 ease-out hover:border-line-strong md:p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-label">{label}</p>
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
            tone === "warning"
              ? "bg-[var(--warning)]/15 text-[var(--warning)]"
              : "bg-accent-soft text-accent-light"
          }`}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="text-xl md:text-2xl">{value}</p>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();
  const lowStock = stats.lowStockCount > 0;

  return (
    <div>
      <p className="text-label mb-2">Painel</p>
      <h1 className="text-heading mb-8 text-3xl">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard
          label="Vendas hoje"
          value={formatCurrency(stats.salesToday)}
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Vendas no mês"
          value={formatCurrency(stats.salesMonth)}
          icon={TrendingUp}
        />
        <MetricCard
          label="Ticket médio"
          value={formatCurrency(stats.averageTicket)}
          icon={Receipt}
        />
        <MetricCard
          label={
            <span className="flex items-center gap-2">
              Estoque baixo
              {lowStock && (
                <AlertTriangle className="size-3.5 text-[var(--warning)]" aria-hidden="true" />
              )}
            </span>
          }
          value={stats.lowStockCount}
          icon={lowStock ? AlertTriangle : Boxes}
          tone={lowStock ? "warning" : "accent"}
        />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
        <div className="rounded-lg border border-line bg-card p-4 md:p-6">
          <p className="text-label mb-6">Vendas — últimos 30 dias</p>
          <SalesChartLazy data={stats.dailySales} />
        </div>

        <div className="rounded-lg border border-line bg-card p-4 md:p-6">
          <p className="text-label mb-6">Pedidos por status</p>
          <ul className="flex flex-col gap-3">
            {Object.entries(STATUS_LABEL).map(([status, label]) => (
              <li key={status} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-ink-muted">
                  <span
                    aria-hidden="true"
                    className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[status] ?? "bg-ink-subtle"}`}
                  />
                  <span className="truncate">{label}</span>
                </span>
                <span className="tabular-nums">{stats.ordersByStatus[status] ?? 0}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
