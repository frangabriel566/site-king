import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { AlertTriangle, Boxes, CircleDollarSign, Globe, Package, Plus, Receipt, Shirt, Store } from "lucide-react";
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
  detail,
  icon: Icon,
  tone = "accent",
  href,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  detail?: React.ReactNode;
  icon: LucideIcon;
  /** "dark": the headline number, black like the logo. */
  tone?: "accent" | "warning" | "dark";
  /** Makes the whole card a link to the page behind the number. */
  href?: string;
}) {
  const dark = tone === "dark";
  const body = (
    <>
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${dark ? "text-white/70" : "text-ink-muted"}`}>
          {label}
        </p>
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
            tone === "warning"
              ? "bg-[var(--warning)]/15 text-[var(--warning)]"
              : dark
                ? "bg-white/15 text-white"
                : "bg-surface-2 text-fg"
          }`}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="text-2xl font-bold tabular-nums tracking-tight md:text-3xl">{value}</p>
      {detail && <p className={`mt-1 text-xs ${dark ? "text-white/70" : "text-ink-muted"}`}>{detail}</p>}
    </>
  );
  const className = `block rounded-xl border p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-150 ease-out md:p-5 ${
    dark ? "border-fg bg-fg text-white" : "border-line bg-card hover:border-line-strong"
  }`;
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();
  const lowStock = stats.lowStockCount > 0;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-label mb-2">Painel</p>
          <h1 className="text-heading text-3xl">Dashboard</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/vendas-loja/nova"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-fg px-4 text-sm font-semibold text-bg transition-colors duration-150 ease-out hover:bg-[var(--accent-hover)]"
          >
            <Plus className="size-4" aria-hidden="true" /> Nova venda
          </Link>
          <Link
            href="/admin/produtos/novo"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line-strong bg-card px-4 text-sm font-semibold text-fg transition-colors duration-150 ease-out hover:border-fg"
          >
            <Shirt className="size-4" aria-hidden="true" /> Novo produto
          </Link>
          <Link
            href="/admin/pedidos"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line-strong bg-card px-4 text-sm font-semibold text-fg transition-colors duration-150 ease-out hover:border-fg"
          >
            <Package className="size-4" aria-hidden="true" /> Pedidos
          </Link>
        </div>
      </div>

      {/* Site and store side by side, never mixed: the sum has its own
          card. Month in big, today underneath. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Vendas do site no mês"
          value={formatCurrency(stats.salesMonth)}
          detail={`Hoje: ${formatCurrency(stats.salesToday)}`}
          icon={Globe}
        />
        <MetricCard
          label="Vendas da loja no mês"
          value={formatCurrency(stats.storeSalesMonth)}
          detail={`Hoje: ${formatCurrency(stats.storeSalesToday)}`}
          icon={Store}
        />
        <MetricCard
          label="Site + loja no mês"
          value={formatCurrency(stats.salesMonth + stats.storeSalesMonth)}
          detail={`Hoje: ${formatCurrency(stats.salesToday + stats.storeSalesToday)}`}
          icon={CircleDollarSign}
          tone="dark"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Ticket médio do site"
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
          href="/admin/estoque"
        />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
        <div className="rounded-xl border border-line bg-card p-4 md:p-6">
          <p className="text-label mb-6">Vendas do site — últimos 30 dias</p>
          <SalesChartLazy data={stats.dailySales} />
        </div>

        <div className="rounded-xl border border-line bg-card p-4 md:p-6">
          <p className="text-label mb-6">Pedidos por status</p>
          <ul className="flex flex-col gap-3">
            {Object.entries(STATUS_LABEL).map(([status, label]) => (
              <li key={status} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-ink-muted">
                  <span
                    aria-hidden="true"
                    className={`size-2 shrink-0 rounded-full ${STATUS_DOT[status] ?? "bg-ink-subtle"}`}
                  />
                  <span className="truncate">{label}</span>
                </span>
                <span className="font-semibold tabular-nums">{stats.ordersByStatus[status] ?? 0}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
