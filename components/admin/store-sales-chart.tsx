"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";

export type StoreSalesChartPoint = {
  label: string;
  /** The column's name in the tooltip: "26/10", "14h às 15h", "outubro". */
  title: string;
  total: number;
  sales: number;
};

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

/** Round axis steps (0 / 100 / 200…) that cover the tallest column. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const rough = max / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? rough;
  const ticks = [0];
  while (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/**
 * Revenue per hour, day or month of the chosen period — one series, so no
 * legend: the card's title names it. Thin columns from a single baseline,
 * a hairline grid, and a tooltip on each column (the value first, then
 * how many sales made it).
 */
export function StoreSalesChart({
  data,
  tickInterval,
}: {
  data: StoreSalesChartPoint[];
  /** Columns skipped between two axis labels (0 = label every one). */
  tickInterval: number;
}) {
  const ticks = niceTicks(Math.max(0, ...data.map((point) => point.total)));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid stroke="var(--line-soft)" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="var(--muted)"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
            interval={tickInterval}
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
              const point = payload?.[0]?.payload as StoreSalesChartPoint | undefined;
              if (!active || !point) return null;
              return (
                <div className="rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-sm">
                  <p className="text-sm font-semibold text-fg">{formatCurrency(point.total)}</p>
                  <p className="text-ink-muted">
                    {point.title} · {point.sales} {point.sales === 1 ? "venda" : "vendas"}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="total" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={24} activeBar={{ fill: "var(--accent-hover)" }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
