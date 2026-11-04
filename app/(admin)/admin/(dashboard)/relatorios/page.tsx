import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CircleDollarSign, Download, Receipt, Shirt, ShoppingBag } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/guards";
import { getSalesReport, type SourceTotals } from "@/lib/data/sales-report";
import { formatCurrency } from "@/lib/format";
import { formatLocalDateTime } from "@/lib/store-sales/period";
import {
  REPORT_RANGES,
  REPORT_SERIES,
  REPORT_SOURCES,
  resolveReportPeriod,
  type ReportRange,
  type ReportSource,
} from "@/lib/reports/period";
import { ReportChartLazy } from "@/components/admin/report-chart-lazy";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Relatórios — Painel" };

/** Reads the sales as they are now; never cached HTML. */
export const dynamic = "force-dynamic";

/** Sales listed on the page; the spreadsheet always has all of them. */
const LIST_LIMIT = 100;

function href(source: ReportSource, range: ReportRange) {
  return `/admin/relatorios?origem=${source}&periodo=${range}`;
}

function Chip({ href: to, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex min-h-10 items-center rounded-lg border px-3.5 text-sm transition-colors duration-150",
        active
          ? "border-gold bg-card font-semibold text-gold-text"
          : "border-line text-ink-muted hover:border-line-strong hover:text-fg",
      )}
    >
      {children}
    </Link>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-lg border border-line bg-card p-4 md:p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-label">{label}</p>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-light">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="text-xl font-semibold md:text-2xl">{value}</p>
      {detail && <p className="mt-1 text-xs text-ink-muted">{detail}</p>}
    </div>
  );
}

function split(site: SourceTotals, loja: SourceTotals, pick: (t: SourceTotals) => string) {
  return `Site ${pick(site)} · Loja ${pick(loja)}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ origem?: string; periodo?: string }>;
}) {
  await requireAdminPage("/admin/relatorios");
  const period = resolveReportPeriod(await searchParams);
  const report = await getSalesReport(period);
  const both = period.source === "todos";
  const series: ("site" | "loja")[] =
    period.source === "todos" ? ["site", "loja"] : [period.source];
  const chartData = report.chart.map((point, index) => ({
    ...point,
    label: period.buckets[index].label,
    title: period.buckets[index].title,
  }));
  const exportHref = `/admin/relatorios/exportar?origem=${period.source}&periodo=${period.range}`;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-label mb-2">Painel</p>
          <h1 className="text-heading text-3xl">Relatórios de vendas</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {REPORT_SOURCES[period.source]} · {period.label}
          </p>
        </div>
        <Button asChild size="lg" variant="outline">
          <a href={exportHref} download>
            <Download className="size-4" aria-hidden="true" /> Baixar planilha (Excel)
          </a>
        </Button>
      </div>

      <div className="mb-8 flex flex-col gap-4 rounded-lg border border-line p-4">
        <div className="flex flex-col gap-2">
          <p className="text-label">Origem</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(REPORT_SOURCES) as ReportSource[]).map((source) => (
              <Chip key={source} href={href(source, period.range)} active={source === period.source}>
                {REPORT_SOURCES[source]}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-label">Período</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(REPORT_RANGES) as ReportRange[]).map((range) => (
              <Chip key={range} href={href(period.source, range)} active={range === period.range}>
                {REPORT_RANGES[range].label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Faturamento"
          value={formatCurrency(report.totals.revenue)}
          detail={both ? split(report.site, report.loja, (t) => formatCurrency(t.revenue)) : undefined}
          icon={CircleDollarSign}
        />
        <StatCard
          label="Vendas"
          value={report.totals.sales}
          detail={both ? split(report.site, report.loja, (t) => String(t.sales)) : undefined}
          icon={ShoppingBag}
        />
        <StatCard
          label="Ticket médio"
          value={formatCurrency(report.totals.averageTicket)}
          detail={
            report.totals.discount > 0
              ? `Descontos dados: ${formatCurrency(report.totals.discount)}`
              : undefined
          }
          icon={Receipt}
        />
        <StatCard
          label="Peças vendidas"
          value={report.totals.pieces}
          detail={both ? split(report.site, report.loja, (t) => String(t.pieces)) : undefined}
          icon={Shirt}
        />
      </div>

      <div className="mb-8 rounded-lg border border-line bg-card p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-label">
            Faturamento por {period.bucketFormat === "%Y-%m-%d" ? "dia" : "mês"}
          </p>
          {both && (
            <div className="flex gap-4 text-xs text-ink-muted">
              {series.map((key) => (
                <span key={key} className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-sm"
                    style={{ backgroundColor: REPORT_SERIES[key].color }}
                  />
                  {REPORT_SERIES[key].label}
                </span>
              ))}
            </div>
          )}
        </div>
        <ReportChartLazy data={chartData} series={series} />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-card p-4 md:p-6">
          <p className="text-label mb-4">Formas de pagamento</p>
          {report.payments.length === 0 ? (
            <p className="text-sm text-ink-muted">Nenhuma venda no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Forma</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.payments.map((pay) => (
                  <TableRow key={pay.label}>
                    <TableCell>{pay.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{pay.sales}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(pay.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="rounded-lg border border-line bg-card p-4 md:p-6">
          <p className="text-label mb-4">Mais vendidos</p>
          {report.topProducts.length === 0 ? (
            <p className="text-sm text-ink-muted">Nenhuma peça vendida no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Peças</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.topProducts.map((product) => (
                  <TableRow key={product.name}>
                    <TableCell className="max-w-[220px] truncate">{product.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{product.qty}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(product.revenue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-line bg-card p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-label">Vendas do período</p>
          {report.sales.length > LIST_LIMIT && (
            <p className="text-xs text-ink-muted">
              Mostrando as {LIST_LIMIT} mais recentes de {report.sales.length}. A planilha traz
              todas.
            </p>
          )}
        </div>
        {report.sales.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhuma venda no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Venda</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Peças</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.sales.slice(0, LIST_LIMIT).map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatLocalDateTime(sale.createdAt)}
                    </TableCell>
                    <TableCell>{sale.origin === "site" ? "Site" : "Loja"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Link
                        href={
                          sale.origin === "site"
                            ? `/admin/pedidos/${sale.id}`
                            : `/admin/vendas-loja/${sale.id}/editar`
                        }
                        className="underline-offset-4 hover:underline"
                      >
                        {sale.number}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">{sale.customer}</TableCell>
                    <TableCell>{sale.payment}</TableCell>
                    <TableCell className="text-right tabular-nums">{sale.pieces}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(sale.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
