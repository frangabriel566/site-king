"use client";

import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";

/** Same two colors as Relatórios: gold for the main series, grey for the
 * one beside it — told apart by lightness too, not only hue. */
export const CHART_COLORS = { primary: "#CDA96B", secondary: "#9AA0A8" } as const;

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 });

const axis = {
  stroke: "var(--muted)",
  fontSize: 11,
  tickLine: false,
} as const;

function Frame({ children }: { children: React.ReactElement }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function TooltipBox({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 text-sm font-semibold text-fg">{title}</p>
      {lines.map((line) => (
        <p key={line} className="text-ink-muted">
          {line}
        </p>
      ))}
    </div>
  );
}

export type VisitorsPoint = { label: string; title: string; users: number; sessions: number };

export function VisitorsChart({ data }: { data: VisitorsPoint[] }) {
  return (
    <Frame>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="visitorsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--line-soft)" vertical={false} />
        <XAxis dataKey="label" {...axis} axisLine={{ stroke: "var(--line)" }} minTickGap={16} />
        <YAxis {...axis} axisLine={false} width={40} allowDecimals={false} tickFormatter={(v: number) => compact.format(v)} />
        <Tooltip
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as VisitorsPoint | undefined;
            if (!active || !p) return null;
            return <TooltipBox title={p.title} lines={[`Visitantes: ${p.users}`, `Sessões: ${p.sessions}`]} />;
          }}
        />
        <Area type="monotone" dataKey="sessions" stroke={CHART_COLORS.secondary} fill="none" strokeWidth={1.5} strokeDasharray="4 3" />
        <Area type="monotone" dataKey="users" stroke={CHART_COLORS.primary} fill="url(#visitorsFill)" strokeWidth={2} />
      </AreaChart>
    </Frame>
  );
}

export type SalesPoint = { label: string; title: string; revenue: number; confirmed: number; started: number };

export function SalesChart({ data }: { data: SalesPoint[] }) {
  return (
    <Frame>
      <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--line-soft)" vertical={false} />
        <XAxis dataKey="label" {...axis} axisLine={{ stroke: "var(--line)" }} minTickGap={16} />
        <YAxis
          yAxisId="money"
          {...axis}
          axisLine={false}
          width={64}
          tickFormatter={(v: number) => (v === 0 ? "0" : `R$ ${compact.format(v)}`)}
        />
        <YAxis yAxisId="count" orientation="right" {...axis} axisLine={false} width={28} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: "var(--accent-soft)" }}
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as SalesPoint | undefined;
            if (!active || !p) return null;
            return (
              <TooltipBox
                title={p.title}
                lines={[
                  `Faturamento: ${formatCurrency(p.revenue)}`,
                  `Pedidos confirmados: ${p.confirmed}`,
                  `Pedidos iniciados: ${p.started}`,
                ]}
              />
            );
          }}
        />
        <Bar yAxisId="money" dataKey="revenue" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Line yAxisId="count" type="monotone" dataKey="confirmed" stroke={CHART_COLORS.secondary} strokeWidth={2} dot={false} />
      </ComposedChart>
    </Frame>
  );
}

export type ConversionPoint = { label: string; title: string; rate: number | null; confirmed: number; sessions: number };

export function ConversionChart({ data }: { data: ConversionPoint[] }) {
  return (
    <Frame>
      <LineChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--line-soft)" vertical={false} />
        <XAxis dataKey="label" {...axis} axisLine={{ stroke: "var(--line)" }} minTickGap={16} />
        <YAxis {...axis} axisLine={false} width={48} tickFormatter={(v: number) => pct.format(v)} />
        <Tooltip
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as ConversionPoint | undefined;
            if (!active || !p) return null;
            return (
              <TooltipBox
                title={p.title}
                lines={[
                  p.rate === null ? "Sem sessões no dia" : `Conversão: ${pct.format(p.rate)}`,
                  `${p.confirmed} pedido(s) confirmado(s) · ${p.sessions} sessões`,
                ]}
              />
            );
          }}
        />
        <Line type="monotone" dataKey="rate" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 2 }} connectNulls />
      </LineChart>
    </Frame>
  );
}

export type MinutePoint = { minutesAgo: number; users: number };

/** The realtime strip: active users per minute, oldest on the left. */
export function MinutesChart({ data }: { data: MinutePoint[] }) {
  return (
    <div className="h-24 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="minutesAgo" hide reversed={false} />
          <YAxis hide allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--accent-soft)" }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as MinutePoint | undefined;
              if (!active || !p) return null;
              return (
                <TooltipBox
                  title={p.minutesAgo === 0 ? "Agora" : `Há ${p.minutesAgo} min`}
                  lines={[`${p.users} ${p.users === 1 ? "visitante ativo" : "visitantes ativos"}`]}
                />
              );
            }}
          />
          <Bar dataKey="users" fill={CHART_COLORS.primary} radius={[2, 2, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
