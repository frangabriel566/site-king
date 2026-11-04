import { MONTH_NAMES, localDayStart, localToday } from "@/lib/store-sales/period";

/**
 * Painel → Relatórios: which sales (site, store or both) over which
 * stretch of time, always ending today. In the store's clock (UTC-3), like
 * "Vendas na loja" (lib/store-sales/period.ts).
 *
 * No `server-only`: the page's filter links use the labels too.
 */

export const REPORT_SOURCES = {
  todos: "Site + loja física",
  site: "Site",
  loja: "Loja física",
} as const;
export type ReportSource = keyof typeof REPORT_SOURCES;

/** The chart's two series: gold for the site, a lighter grey for the
 * store, so they tell apart by lightness too, not only by hue. */
export const REPORT_SERIES = {
  site: { label: "Site", color: "#CDA96B" },
  loja: { label: "Loja física", color: "#9AA0A8" },
} as const;

export const REPORT_RANGES = {
  "7d": { label: "1 semana", days: 7, months: 0 },
  "3m": { label: "3 meses", days: 0, months: 3 },
  "6m": { label: "6 meses", days: 0, months: 6 },
  "8m": { label: "8 meses", days: 0, months: 8 },
  "10m": { label: "10 meses", days: 0, months: 10 },
  "12m": { label: "1 ano", days: 0, months: 12 },
} as const;
export type ReportRange = keyof typeof REPORT_RANGES;

export type ReportPeriod = {
  source: ReportSource;
  range: ReportRange;
  /** UTC ISO bounds, start inclusive, end exclusive. */
  start: string;
  end: string;
  /** "29/10/2026 a 04/11/2026". */
  label: string;
  /** Chart columns: days for a week, months otherwise. */
  buckets: { key: string; label: string; title: string }[];
  /** `strftime` format turning a local timestamp into a bucket key. */
  bucketFormat: "%Y-%m-%d" | "%Y-%m";
};

const pad = (n: number) => String(n).padStart(2, "0");

function shiftDay(day: string, delta: number): string {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

const br = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;

export function isReportSource(value: unknown): value is ReportSource {
  return typeof value === "string" && value in REPORT_SOURCES;
}

export function isReportRange(value: unknown): value is ReportRange {
  return typeof value === "string" && value in REPORT_RANGES;
}

/**
 * The period from `?origem=&periodo=`; anything unreadable falls back to
 * both sources over 1 semana. A week is today and the 6 days before; "N
 * meses" starts on the same day N months back (3 meses on 04/11 starts on
 * 04/08) and is charted month by month.
 */
export function resolveReportPeriod(
  params: { origem?: string; periodo?: string },
  now: Date = new Date(),
): ReportPeriod {
  const source: ReportSource = isReportSource(params.origem) ? params.origem : "todos";
  const range: ReportRange = isReportRange(params.periodo) ? params.periodo : "7d";
  const spec = REPORT_RANGES[range];
  const today = localToday(now);
  const tomorrow = shiftDay(today, 1);

  let firstDay: string;
  if (spec.days > 0) {
    firstDay = shiftDay(today, -(spec.days - 1));
  } else {
    // Same day of the month, N months back; clamped (31/05 → 28/02).
    const month = shiftMonth(today.slice(0, 7), -spec.months);
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    firstDay = `${month}-${pad(Math.min(Number(today.slice(8, 10)), lastDay))}`;
  }

  const buckets: ReportPeriod["buckets"] = [];
  if (spec.days > 0) {
    for (let day = firstDay; day <= today; day = shiftDay(day, 1)) {
      buckets.push({ key: day, label: `${day.slice(8, 10)}/${day.slice(5, 7)}`, title: br(day) });
    }
  } else {
    for (let month = firstDay.slice(0, 7); month <= today.slice(0, 7); month = shiftMonth(month, 1)) {
      const name = MONTH_NAMES[Number(month.slice(5, 7)) - 1];
      buckets.push({
        key: month,
        label: `${name.slice(0, 3)}/${month.slice(2, 4)}`,
        title: `${name} de ${month.slice(0, 4)}`,
      });
    }
  }

  return {
    source,
    range,
    start: localDayStart(firstDay).toISOString(),
    end: localDayStart(tomorrow).toISOString(),
    label: `${br(firstDay)} a ${br(today)}`,
    buckets,
    bucketFormat: spec.days > 0 ? "%Y-%m-%d" : "%Y-%m",
  };
}

/** How a site order was paid, as stored in orders.payment_method. */
export function sitePaymentLabel(method: string | null): string {
  if (!method) return "Não informado";
  const known: Record<string, string> = {
    mercadopago: "Mercado Pago",
    mercado_pago: "Mercado Pago",
    whatsapp: "WhatsApp",
    pix: "Pix",
  };
  return known[method] ?? method;
}
