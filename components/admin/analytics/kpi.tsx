import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { change } from "@/lib/analytics/period";
import { cn } from "@/lib/utils";

/** Where a number comes from — always on the card, so a GA4 estimate is
 * never read as a sale. */
export type MetricSource = "ga4" | "pedidos" | "misto";

const SOURCE_LABEL: Record<MetricSource, string> = {
  ga4: "GA4",
  pedidos: "Pedidos",
  misto: "Pedidos ÷ GA4",
};

export function SourceTag({ source }: { source: MetricSource }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        source === "pedidos" ? "bg-accent-soft text-accent-light" : "bg-surface-2 text-ink-muted",
      )}
    >
      {SOURCE_LABEL[source]}
    </span>
  );
}

const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

/** "+12,5%" against the previous period; green up, red down. For a rate
 * (conversão), the difference in points is what matters, not % of %. */
export function Delta({
  current,
  previous,
  points = false,
}: {
  current: number;
  previous: number;
  points?: boolean;
}) {
  const value = points ? current - previous : change(current, previous);
  if (value === null) {
    return <span className="text-xs text-ink-muted">sem base anterior</span>;
  }
  const up = value > 0.0005;
  const down = value < -0.0005;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  const text = points
    ? `${value > 0 ? "+" : ""}${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} p.p.`
    : `${value > 0 ? "+" : ""}${pct.format(value)}`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        up && "text-[var(--success)]",
        down && "text-[var(--danger)]",
        !up && !down && "text-ink-muted",
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {text}
      <span className="sr-only"> em relação ao período anterior</span>
    </span>
  );
}

export function KpiCard({
  label,
  value,
  source,
  icon: Icon,
  delta,
  detail,
}: {
  label: string;
  /** Null when the source isn't available: shown as a dash, never a 0. */
  value: React.ReactNode | null;
  source: MetricSource;
  icon: LucideIcon;
  delta?: React.ReactNode;
  detail?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-line bg-card p-4 transition-colors duration-150 ease-out hover:border-line-strong md:p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex flex-col items-start gap-1.5">
          <p className="text-label">{label}</p>
          <SourceTag source={source} />
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-light">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="text-xl font-semibold tabular-nums md:text-2xl">
        {value === null ? <span className="text-ink-muted">—</span> : value}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {value !== null && delta}
        {detail && <span className="text-xs text-ink-muted">{detail}</span>}
      </div>
    </div>
  );
}
