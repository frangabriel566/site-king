import type { Metadata } from "next";
import Link from "next/link";
import {
  CircleDollarSign,
  CreditCard,
  Eye,
  MessageCircle,
  MousePointerClick,
  Percent,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  TriangleAlert,
  Users,
  Waypoints,
} from "lucide-react";
import { requireAdminPage } from "@/lib/auth/guards";
import { getGaOverview, getGaRealtime, type GaOverview } from "@/lib/analytics/ga4-data";
import { getStoreAnalytics } from "@/lib/analytics/store-data";
import {
  ANALYTICS_RANGES,
  brDate,
  resolveAnalyticsPeriod,
  type AnalyticsRange,
} from "@/lib/analytics/period";
import { formatCurrency } from "@/lib/format";
import { localToday } from "@/lib/store-sales/period";
import { RealtimePanel } from "@/components/admin/analytics/realtime-panel";
import { Delta, KpiCard, SourceTag } from "@/components/admin/analytics/kpi";
import {
  ConversionChartLazy,
  SalesChartLazy,
  VisitorsChartLazy,
} from "@/components/admin/analytics/analytics-charts-lazy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics — Painel" };
export const dynamic = "force-dynamic";

const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 });
const num = (value: number) => value.toLocaleString("pt-BR");

const WHATSAPP_LOCATION_LABEL: Record<string, string> = {
  botao_flutuante: "Botão flutuante",
  produto_comprar: "Comprar pelo WhatsApp (produto)",
  sacola_finalizar: "Finalizar pela sacola",
  checkout: "Checkout (pagar no WhatsApp)",
  cabecalho: "Cabeçalho",
  rodape: "Rodapé",
  pagina: "Botões da página",
  outro: "Outros",
};

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
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

function Card({
  title,
  source,
  note,
  children,
  className,
}: {
  title: string;
  source?: React.ComponentProps<typeof SourceTag>["source"];
  note?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-line bg-card p-4 md:p-6", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-label">{title}</h2>
          {source && <SourceTag source={source} />}
        </div>
        {note && <p className="text-xs text-ink-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function GaUnavailable({ text }: { text: string }) {
  return <p className="flex h-full min-h-24 items-center text-sm text-ink-muted">{text}</p>;
}

/** The setup still missing, or GA4's error, in plain words. */
function GaNotice({ status }: { status: Awaited<ReturnType<typeof getGaOverview>>["status"] }) {
  if (status.ok) return null;
  return (
    <div className="mb-8 flex gap-3 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-4 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" aria-hidden="true" />
      {status.reason === "not_configured" ? (
        <div>
          <p className="font-semibold">Falta conectar o Google Analytics ao painel</p>
          <p className="mt-1 text-ink-muted">
            Vendas, pedidos e faturamento já aparecem (vêm dos pedidos da loja). Visitantes,
            produtos vistos, carrinhos, WhatsApp e tempo real precisam da conexão com o GA4:
            configure no Cloudflare a variável <code>GA4_PROPERTY_ID</code> e o segredo{" "}
            <code>GA4_SERVICE_ACCOUNT_JSON</code>. Falta agora: {status.missing.join(", ")}.
          </p>
        </div>
      ) : (
        <div>
          <p className="font-semibold">O Google Analytics não respondeu</p>
          <p className="mt-1 text-ink-muted">
            {status.message} Os números de pedidos continuam corretos; os do GA4 aparecem
            como “—” até a conexão voltar. Nenhum número é estimado.
          </p>
        </div>
      )}
    </div>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string }>;
}) {
  await requireAdminPage("/admin/analytics");
  const params = await searchParams;
  const period = resolveAnalyticsPeriod(params);
  const [store, ga, realtime] = await Promise.all([
    getStoreAnalytics(period),
    getGaOverview(period),
    getGaRealtime(localToday()),
  ]);
  const g: GaOverview | null = ga.data;
  const s = store.current;
  const sp = store.previous;

  // Conversão: pedidos confirmados (banco) ÷ sessões (GA4).
  const rate = (orders: number, sessions: number) => (sessions > 0 ? orders / sessions : null);
  const conversion = g ? rate(s.confirmed, g.current.sessions) : null;
  const conversionPrev = g ? rate(sp.confirmed, g.previous.sessions) : null;

  const short = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
  const sessionsByDay = new Map(g?.daily.map((d) => [d.day, d.sessions]) ?? []);
  const visitorsData = g?.daily.map((d) => ({ label: short(d.day), title: brDate(d.day), users: d.users, sessions: d.sessions })) ?? [];
  const salesData = store.daily.map((d) => ({ label: short(d.day), title: brDate(d.day), ...d }));
  const conversionData = store.daily.map((d) => {
    const sessions = sessionsByDay.get(d.day) ?? 0;
    return { label: short(d.day), title: brDate(d.day), rate: rate(d.confirmed, sessions), confirmed: d.confirmed, sessions };
  });

  const customFirst = params.periodo === "personalizado" ? period.firstDay : "";
  const customLast = params.periodo === "personalizado" ? period.lastDay : "";
  const totalSourceSessions = g?.sources.reduce((sum, src) => sum + src.sessions, 0) ?? 0;

  const comparison: { label: string; source: "ga4" | "pedidos" | "misto"; current: number | null; previous: number | null; format: (v: number) => string; points?: boolean }[] = [
    { label: "Visitantes", source: "ga4", current: g?.current.users ?? null, previous: g?.previous.users ?? null, format: num },
    { label: "Sessões", source: "ga4", current: g?.current.sessions ?? null, previous: g?.previous.sessions ?? null, format: num },
    { label: "Páginas vistas", source: "ga4", current: g?.current.pageViews ?? null, previous: g?.previous.pageViews ?? null, format: num },
    { label: "Produtos vistos", source: "ga4", current: g?.current.events.view_item ?? null, previous: g?.previous.events.view_item ?? null, format: num },
    { label: "Adições à sacola", source: "ga4", current: g?.current.events.add_to_cart ?? null, previous: g?.previous.events.add_to_cart ?? null, format: num },
    { label: "Checkouts iniciados", source: "ga4", current: g?.current.events.begin_checkout ?? null, previous: g?.previous.events.begin_checkout ?? null, format: num },
    { label: "Cliques no WhatsApp", source: "ga4", current: g?.current.events.click_whatsapp ?? null, previous: g?.previous.events.click_whatsapp ?? null, format: num },
    { label: "Pedidos iniciados", source: "pedidos", current: s.started, previous: sp.started, format: num },
    { label: "Pedidos confirmados", source: "pedidos", current: s.confirmed, previous: sp.confirmed, format: num },
    { label: "Pagamentos confirmados", source: "pedidos", current: s.paymentsConfirmed, previous: sp.paymentsConfirmed, format: num },
    { label: "Faturamento", source: "pedidos", current: s.revenue, previous: sp.revenue, format: formatCurrency },
    { label: "Ticket médio", source: "pedidos", current: s.averageTicket, previous: sp.averageTicket, format: formatCurrency },
    { label: "Taxa de conversão", source: "misto", current: conversion, previous: conversionPrev, format: (v) => pct.format(v), points: true },
  ];

  return (
    <div>
      <div className="mb-6">
        <p className="text-label mb-2">Painel</p>
        <h1 className="text-heading text-3xl">Analytics</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {ANALYTICS_RANGES[period.range]} · {period.label}
          <span className="mx-1.5">·</span>
          comparado a {period.previous.label}
        </p>
      </div>

      <div className="mb-8 flex flex-col gap-4 rounded-lg border border-line p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-label">Período</p>
          <div className="flex flex-wrap gap-2">
            {(["hoje", "ontem", "7d", "30d"] as AnalyticsRange[]).map((range) => (
              <Chip key={range} href={`/admin/analytics?periodo=${range}`} active={period.range === range}>
                {ANALYTICS_RANGES[range]}
              </Chip>
            ))}
          </div>
        </div>
        <form method="get" action="/admin/analytics" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="periodo" value="personalizado" />
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            De
            <Input type="date" name="de" defaultValue={customFirst} max={localToday()} required className="h-10 w-40" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Até
            <Input type="date" name="ate" defaultValue={customLast} max={localToday()} required className="h-10 w-40" />
          </label>
          <Button
            type="submit"
            size="lg"
            variant={period.range === "personalizado" ? "default" : "outline"}
            className="h-10"
          >
            Aplicar
          </Button>
        </form>
      </div>

      <GaNotice status={ga.status} />

      <RealtimePanel initial={realtime} />

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Desempenho da loja</h2>
        <p className="text-xs text-ink-muted">
          {period.includesToday
            ? "GA4: relatório consolidado — os números de hoje ainda podem subir nas próximas horas."
            : "GA4: relatório consolidado."}{" "}
          Pedidos: banco de dados da loja, em tempo real.
        </p>
      </div>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
        <KpiCard
          label="Visitantes"
          source="ga4"
          icon={Users}
          value={g ? num(g.current.users) : null}
          delta={g && <Delta current={g.current.users} previous={g.previous.users} />}
        />
        <KpiCard
          label="Sessões"
          source="ga4"
          icon={Waypoints}
          value={g ? num(g.current.sessions) : null}
          delta={g && <Delta current={g.current.sessions} previous={g.previous.sessions} />}
        />
        <KpiCard
          label="Produtos vistos"
          source="ga4"
          icon={Eye}
          value={g ? num(g.current.events.view_item) : null}
          delta={g && <Delta current={g.current.events.view_item} previous={g.previous.events.view_item} />}
        />
        <KpiCard
          label="Adições à sacola"
          source="ga4"
          icon={ShoppingCart}
          value={g ? num(g.current.events.add_to_cart) : null}
          delta={g && <Delta current={g.current.events.add_to_cart} previous={g.previous.events.add_to_cart} />}
          detail={g ? `${num(g.itemsAddedToCart)} peças` : undefined}
        />
        <KpiCard
          label="Checkouts iniciados"
          source="ga4"
          icon={MousePointerClick}
          value={g ? num(g.current.events.begin_checkout) : null}
          delta={g && <Delta current={g.current.events.begin_checkout} previous={g.previous.events.begin_checkout} />}
        />
        <KpiCard
          label="Compras confirmadas"
          source="pedidos"
          icon={ShoppingBag}
          value={num(s.confirmed)}
          delta={<Delta current={s.confirmed} previous={sp.confirmed} />}
          detail={`Site ${s.confirmedByChannel.site} · WhatsApp ${s.confirmedByChannel.whatsapp}`}
        />
        <KpiCard
          label="Faturamento"
          source="pedidos"
          icon={CircleDollarSign}
          value={formatCurrency(s.revenue)}
          delta={<Delta current={s.revenue} previous={sp.revenue} />}
        />
        <KpiCard
          label="Ticket médio"
          source="pedidos"
          icon={Receipt}
          value={formatCurrency(s.averageTicket)}
          delta={<Delta current={s.averageTicket} previous={sp.averageTicket} />}
        />
        <KpiCard
          label="Taxa de conversão"
          source="misto"
          icon={Percent}
          value={conversion === null ? null : pct.format(conversion)}
          delta={
            conversion !== null && conversionPrev !== null ? (
              <Delta current={conversion} previous={conversionPrev} points />
            ) : undefined
          }
          detail="compras confirmadas ÷ sessões"
        />
        <KpiCard
          label="Cliques no WhatsApp"
          source="ga4"
          icon={MessageCircle}
          value={g ? num(g.current.events.click_whatsapp) : null}
          delta={g && <Delta current={g.current.events.click_whatsapp} previous={g.previous.events.click_whatsapp} />}
          detail="não são vendas"
        />
      </div>

      <Card title="WhatsApp e site: do clique ao pagamento" className="mb-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: "Cliques no WhatsApp",
              source: "ga4" as const,
              value: g ? num(g.current.events.click_whatsapp) : null,
              detail: "conversas abertas pelo site",
              icon: MessageCircle,
            },
            {
              label: "Pedidos iniciados",
              source: "pedidos" as const,
              value: num(s.started),
              detail: `Site ${s.startedByChannel.site} · WhatsApp ${s.startedByChannel.whatsapp}`,
              icon: ShoppingCart,
            },
            {
              label: "Pedidos confirmados",
              source: "pedidos" as const,
              value: num(s.confirmed),
              detail: `Site ${s.confirmedByChannel.site} · WhatsApp ${s.confirmedByChannel.whatsapp}`,
              icon: ShoppingBag,
            },
            {
              label: "Pagamentos confirmados",
              source: "pedidos" as const,
              value: num(s.paymentsConfirmed),
              detail: "aprovados pelo Mercado Pago",
              icon: CreditCard,
            },
          ].map((step, index) => (
            <div key={step.label} className="relative rounded-lg border border-line bg-bg p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs text-ink-muted">{index + 1}</span>
                <SourceTag source={step.source} />
              </div>
              <p className="flex items-center gap-1.5 text-sm">
                <step.icon className="size-4 text-accent-light" aria-hidden="true" />
                {step.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {step.value ?? <span className="text-ink-muted">—</span>}
              </p>
              <p className="mt-1 text-xs text-ink-muted">{step.detail}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          Faturamento por canal: site {formatCurrency(s.revenueByChannel.site)} · WhatsApp{" "}
          {formatCurrency(s.revenueByChannel.whatsapp)}. Um clique no WhatsApp nunca conta como
          venda: a venda só entra quando o pedido é confirmado.
        </p>
      </Card>

      <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Visitantes por dia" source="ga4" note="linha cheia: visitantes · tracejada: sessões">
          {g ? <VisitorsChartLazy data={visitorsData} /> : <GaUnavailable text="Disponível com o GA4 conectado." />}
        </Card>
        <Card title="Vendas e faturamento" source="pedidos" note="barras: faturamento · linha: pedidos confirmados">
          <SalesChartLazy data={salesData} />
        </Card>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Evolução da taxa de conversão" source="misto">
          {g ? <ConversionChartLazy data={conversionData} /> : <GaUnavailable text="Disponível com o GA4 conectado." />}
        </Card>
        <Card title="Comparativo de períodos" note={`${period.label} × ${period.previous.label}`}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicador</TableHead>
                  <TableHead className="text-right">Atual</TableHead>
                  <TableHead className="text-right">Anterior</TableHead>
                  <TableHead className="text-right">Variação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparison.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell>
                      <span className="mr-2">{row.label}</span>
                      <SourceTag source={row.source} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.current === null ? "—" : row.format(row.current)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-ink-muted">
                      {row.previous === null ? "—" : row.format(row.previous)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.current === null || row.previous === null ? (
                        <span className="text-xs text-ink-muted">—</span>
                      ) : (
                        <Delta current={row.current} previous={row.previous} points={row.points} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Produtos mais vistos" source="ga4">
          {!g ? (
            <GaUnavailable text="Disponível com o GA4 conectado." />
          ) : g.topProducts.length === 0 ? (
            <GaUnavailable text="Nenhum produto visto no período (ou os eventos ainda não chegaram ao GA4)." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Vistos</TableHead>
                  <TableHead className="text-right">Na sacola</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.topProducts.map((product, index) => (
                  <TableRow key={product.id || product.name}>
                    <TableCell className="text-ink-muted tabular-nums">{index + 1}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{product.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(product.views)}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(product.addedToCart)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card title="Fontes de tráfego" source="ga4" note="por sessões">
          {!g ? (
            <GaUnavailable text="Disponível com o GA4 conectado." />
          ) : g.sources.length === 0 ? (
            <GaUnavailable text="Nenhuma sessão no período." />
          ) : (
            <ul className="flex flex-col gap-3">
              {g.sources.map((src) => {
                const share = totalSourceSessions > 0 ? src.sessions / totalSourceSessions : 0;
                return (
                  <li key={src.key} className="text-sm">
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <span className="truncate">{src.label}</span>
                      <span className="shrink-0 tabular-nums text-ink-muted">
                        {num(src.sessions)} · {pct.format(share)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-2">
                      <div className="h-1.5 rounded-full bg-gold" style={{ width: `${share * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {g?.whatsappByLocation && g.whatsappByLocation.length > 0 && (
            <div className="mt-6 border-t border-line pt-4">
              <p className="text-label mb-3">Cliques no WhatsApp por local</p>
              <ul className="flex flex-col gap-1.5 text-sm">
                {g.whatsappByLocation.map((row) => (
                  <li key={row.location} className="flex justify-between gap-3">
                    <span>{WHATSAPP_LOCATION_LABEL[row.location] ?? row.location}</span>
                    <span className="tabular-nums text-ink-muted">{num(row.clicks)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <p className="text-xs text-ink-muted">
        <strong className="font-semibold">Fontes:</strong> “Pedidos” vem do banco de dados da loja
        (o mesmo de Relatórios) e é o número oficial de vendas e faturamento do site. “GA4” vem do
        Google Analytics: visitantes que recusaram cookies aparecem só de forma estimada, e os
        relatórios consolidados têm atraso de algumas horas. A variação compara com o período
        anterior de mesmo tamanho.
      </p>
    </div>
  );
}
