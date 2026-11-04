"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";
import { REPORT_SERIES } from "@/lib/reports/period";

export type ReportChartPoint = {
  label: string;
  title: string;
  site: number;
  loja: number;
  sales: number;
};

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const rough = max / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? rough;
  const ticks = [0];
  while (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/** Revenue per day (1 semana) or month, the site and the store stacked. */
export function ReportChart({
  data,
  series,
}: {
  data: ReportChartPoint[];
  series: ("site" | "loja")[];
}) {
  const ticks = niceTicks(Math.max(0, ...data.map((p) => p.site + p.loja)));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 4, left: 0, bottom: 0 }} barCategoryGap={4}>
          <CartesianGrid stroke="var(--line-soft)" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="var(--muted)"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
          />
          <YAxis
            stroke="var(--muted)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={72}
            ticks={ticks}
            domain={[0, ticks[ticks.length - 1]]}
            tickFormatter={(value: number) => (value === 0 ? "0" : `R$ ${compact.format(value)}`)}
          />
          <Tooltip
            cursor={{ fill: "var(--accent-soft)" }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as ReportChartPoint | undefined;
              if (!active || !point) return null;
              return (
                <div className="rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-sm">
                  <p className="text-sm font-semibold text-fg">
                    {formatCurrency(point.site + point.loja)}
                  </p>
                  <p className="mb-1 text-ink-muted">
                    {point.title} · {point.sales} {point.sales === 1 ? "venda" : "vendas"}
                  </p>
                  {series.length > 1 &&
                    series.map((key) => (
                      <p key={key} className="text-ink-muted">
                        {REPORT_SERIES[key].label}: {formatCurrency(point[key])}
                      </p>
                    ))}
                </div>
              );
            }}
          />
          {series.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="total"
              fill={REPORT_SERIES[key].color}
              radius={index === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              maxBarSize={40}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
