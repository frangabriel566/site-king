import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CircleDollarSign, Pencil, Plus, Receipt, Shirt, ShoppingBag } from "lucide-react";
import { getFirstStoreSaleYear, getStoreSalesDashboard } from "@/lib/data/store-sales";
import { formatCurrency, formatVariantLabel } from "@/lib/format";
import { roundMoney } from "@/lib/money";
import { formatLocalDateTime, localToday, resolvePeriod, MONTH_NAMES, type Period } from "@/lib/store-sales/period";
import { STORE_PAYMENT_LABEL } from "@/lib/store-sales/payment-methods";
import { SafeImage } from "@/components/shop/safe-image";
import { DeleteButton } from "@/components/admin/delete-button";
import { StatusBadge } from "@/components/admin/status-badge";
import { deleteStoreSaleAction } from "@/lib/actions/store-sales";
import { StoreSalesChartLazy } from "@/components/admin/store-sales-chart-lazy";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PeriodFilter } from "./period-filter";
import { CancelSaleButton } from "./cancel-sale-button";

export const metadata: Metadata = { title: "Vendas na loja — Painel" };

/** Reads the sales as they are now; never cached HTML. */
export const dynamic = "force-dynamic";

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

/** The chart's tooltip title for each column. */
function bucketTitle(period: Period, key: string): string {
  if (period.mode === "dia") return `${key}h às ${String(Number(key) + 1).padStart(2, "0")}h`;
  if (period.mode === "mes") return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
  return MONTH_NAMES[Number(key.slice(5, 7)) - 1];
}

const CHART_TITLE: Record<Period["mode"], string> = {
  dia: "Faturamento por hora",
  mes: "Faturamento por dia",
  ano: "Faturamento por mês",
};

export default async function StoreSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; data?: string }>;
}) {
  const params = await searchParams;
  const period = resolvePeriod(params);
  // "Editar" comes back to this same period after saving.
  const periodSearch = new URLSearchParams(
    Object.entries({ periodo: params.periodo, data: params.data }).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  ).toString();
  const periodQuery = periodSearch ? `?${periodSearch}` : "";
  const today = localToday();
  const [stats, firstYear] = await Promise.all([getStoreSalesDashboard(period), getFirstStoreSaleYear()]);

  const currentYear = Number(today.slice(0, 4));
  const years = Array.from(
    { length: currentYear - Math.min(firstYear ?? currentYear, currentYear) + 1 },
    (_, i) => Math.min(firstYear ?? currentYear, currentYear) + i,
  );
  const maxQty = Math.max(1, ...stats.topProducts.map((product) => product.qty));
  const empty = stats.sales === 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PeriodFilter
          mode={period.mode}
          periodKey={period.key}
          label={period.label}
          prev={period.prev}
          next={period.next}
          today={today}
          years={years}
        />
        <Button asChild>
          <Link href="/admin/vendas-loja/nova">
            <Plus aria-hidden="true" />
            Nova baixa
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Faturamento"
          value={formatCurrency(stats.revenue)}
          detail={stats.discount > 0 ? `${formatCurrency(stats.discount)} em descontos` : undefined}
          icon={CircleDollarSign}
        />
        <StatCard label="Vendas" value={stats.sales} icon={ShoppingBag} />
        <StatCard label="Peças vendidas" value={stats.pieces} icon={Shirt} />
        <StatCard label="Ticket médio" value={formatCurrency(stats.averageTicket)} icon={Receipt} />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">
        <section className="rounded-lg border border-line bg-card p-4 md:p-6">
          <h2 className="text-label mb-6">{CHART_TITLE[period.mode]}</h2>
          {empty ? (
            <p className="py-16 text-center text-sm text-ink-muted">Nenhuma venda neste período.</p>
          ) : (
            <StoreSalesChartLazy
              data={stats.series.map((point) => ({
                label: point.label,
                title: bucketTitle(period, point.key),
                total: point.total,
                sales: point.sales,
              }))}
              tickInterval={period.mode === "ano" ? 0 : 2}
            />
          )}
        </section>

        <section className="rounded-lg border border-line bg-card p-4 md:p-6">
          <h2 className="text-label mb-6">Formas de pagamento</h2>
          {stats.byPayment.length === 0 ? (
            <p className="text-sm text-ink-muted">Nenhuma venda neste período.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {stats.byPayment.map((row) => {
                const share = stats.revenue > 0 ? row.total / stats.revenue : 0;
                return (
                  <li key={row.method} className="text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <span>{STORE_PAYMENT_LABEL[row.method] ?? row.method}</span>
                      <span className="tabular-nums">{formatCurrency(row.total)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--line-soft)]" aria-hidden="true">
                      <div className="h-full rounded-full bg-accent-solid" style={{ width: `${share * 100}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">
                      {row.sales} {row.sales === 1 ? "venda" : "vendas"} · {Math.round(share * 100)}%
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-line bg-card p-4 md:p-6">
        <h2 className="text-label mb-1">Peças mais vendidas</h2>
        <p className="mb-6 text-xs text-ink-muted">
          Por quantidade, em {period.label}. O valor já desconta o desconto de cada venda.
        </p>
        {stats.topProducts.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhuma peça vendida neste período.</p>
        ) : (
          <ol className="flex flex-col gap-5">
            {stats.topProducts.map((product, index) => (
              <li key={product.key} className="flex items-center gap-3 md:gap-4">
                <span className="w-5 shrink-0 text-right text-sm tabular-nums text-ink-muted">{index + 1}</span>
                <div className="relative size-11 shrink-0 overflow-hidden rounded-md bg-field">
                  {product.image && (
                    <SafeImage src={product.image} alt="" fill sizes="44px" fallbackLabel="" className="object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    <p className="shrink-0 text-sm tabular-nums">
                      {product.qty} {product.qty === 1 ? "peça" : "peças"}
                    </p>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--line-soft)]" aria-hidden="true">
                    <div
                      className="h-full rounded-full bg-accent-solid"
                      style={{ width: `${(product.qty / maxQty) * 100}%` }}
                    />
                  </div>
                  <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-ink-muted">
                    <span className="truncate">
                      {product.variants
                        .map((variant) => {
                          const label = formatVariantLabel(variant.color, variant.size);
                          return label ? `${label} (${variant.qty})` : null;
                        })
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="tabular-nums">{formatCurrency(product.revenue)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2 className="text-label mb-4">Histórico de baixas</h2>
        {stats.list.length === 0 ? (
          <div className="rounded-lg border border-line bg-card p-6 text-sm text-ink-muted">
            Nenhuma baixa em {period.label}.{" "}
            <Link href="/admin/vendas-loja/nova" className="text-accent-light hover:underline">
              Registrar uma venda
            </Link>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-line hover:bg-transparent">
                  <TableHead>Venda</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Peças</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.list.map((sale) => {
                  const canceled = Boolean(sale.canceled_at);
                  return (
                    <TableRow key={sale.id} className={`border-line align-top ${canceled ? "text-ink-muted" : ""}`}>
                      <TableCell className="font-medium">
                        #{sale.sale_number}
                        {canceled && (
                          <StatusBadge tone="neutral" className="mt-1 block w-fit">
                            Desfeita
                          </StatusBadge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-ink-muted">
                        {formatLocalDateTime(sale.created_at)}
                      </TableCell>
                      <TableCell className="text-ink-muted">{sale.customer_name ?? "—"}</TableCell>
                      <TableCell className="text-ink-muted">
                        <ul className="flex flex-col gap-1 text-xs">
                          {sale.items.map((item) => {
                            const variant = formatVariantLabel(item.color, item.size);
                            return (
                              <li key={item.id}>
                                {item.qty}x {item.name}
                                {variant ? ` — ${variant}` : ""}
                              </li>
                            );
                          })}
                        </ul>
                        {sale.note && <p className="mt-1 text-xs italic">{sale.note}</p>}
                      </TableCell>
                      <TableCell className="text-ink-muted">
                        {STORE_PAYMENT_LABEL[sale.payment_method] ?? sale.payment_method}
                        {sale.cash_received !== null && (
                          <span className="mt-0.5 block whitespace-nowrap text-xs">
                            recebeu {formatCurrency(sale.cash_received)}
                            <span className="block">troco {formatCurrency(roundMoney(sale.cash_received - sale.total))}</span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={canceled ? "line-through" : undefined}>{formatCurrency(sale.total)}</span>
                        {sale.discount > 0 && (
                          <span className="mt-0.5 block text-xs text-ink-muted">
                            desconto {formatCurrency(sale.discount)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!canceled && (
                            <CancelSaleButton
                              saleId={sale.id}
                              saleNumber={sale.sale_number}
                              total={formatCurrency(sale.total)}
                            />
                          )}
                          {/* An undone sale opens too: saving brings it back. */}
                          <Button variant="ghost" size="icon-sm" asChild>
                            <Link
                              href={`/admin/vendas-loja/${sale.id}/editar${periodQuery}`}
                              aria-label={`Editar a venda #${sale.sale_number}`}
                              title="Editar"
                            >
                              <Pencil className="size-4" />
                            </Link>
                          </Button>
                          <DeleteButton
                            itemLabel={`a venda #${sale.sale_number}`}
                            description={
                              canceled
                                ? "Ela sai do histórico de vez. As peças já tinham voltado ao estoque quando a baixa foi desfeita."
                                : `As peças voltam ao estoque e a venda de ${formatCurrency(sale.total)} sai do histórico e dos totais de vez. Não dá para recuperar.`
                            }
                            action={deleteStoreSaleAction.bind(null, { sale_id: sale.id })}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {stats.list.length >= stats.listLimit && (
              <p className="mt-3 text-xs text-ink-muted">
                Mostrando as {stats.listLimit} baixas mais recentes. Escolha um período menor para ver as outras.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
