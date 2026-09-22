"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";

export function SalesChart({ data }: { data: { date: string; total: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          {/* Recharts writes these straight into SVG attributes, so they
              resolve against the panel's own tokens — the chart follows the
              theme instead of pinning its own copy of the palette. */}
          <defs>
            <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line-soft)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => value.slice(8, 10)}
            stroke="var(--muted)"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "var(--line-soft)" }}
            interval={4}
          />
          <YAxis hide />
          <Tooltip
            formatter={(value) => formatCurrency(Number(value ?? 0))}
            cursor={{ stroke: "var(--accent-light)", strokeWidth: 1 }}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              fontSize: 12,
              color: "var(--fg)",
            }}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="var(--accent-hover)"
            strokeWidth={2}
            fill="url(#salesGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
