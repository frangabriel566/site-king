import { localDayStart, localToday } from "@/lib/store-sales/period";

/**
 * Painel → Analytics: the period being looked at and the one it is compared
 * with (the same number of days right before it). Days in the store's
 * clock (UTC-3), like every other panel report; GA4 gets them as dates,
 * the orders table as UTC bounds.
 *
 * No `server-only`: the filter bar uses the labels too.
 */

export const ANALYTICS_RANGES = {
  hoje: "Hoje",
  ontem: "Ontem",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  personalizado: "Personalizado",
} as const;
export type AnalyticsRange = keyof typeof ANALYTICS_RANGES;

/** GA4 keeps 14 months of event data on a standard property. */
export const MAX_CUSTOM_DAYS = 400;

export type DaySpan = {
  /** YYYY-MM-DD, inclusive both ends. */
  firstDay: string;
  lastDay: string;
  /** UTC ISO bounds for the database: start inclusive, end exclusive. */
  start: string;
  end: string;
  days: string[];
  /** "07/11/2026" or "01/11/2026 a 07/11/2026". */
  label: string;
};

export type AnalyticsPeriod = DaySpan & {
  range: AnalyticsRange;
  previous: DaySpan;
  /** True when the period includes today: GA4's numbers for today are
   * still coming in. */
  includesToday: boolean;
};

export function shiftDay(day: string, delta: number): string {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function dayCount(first: string, last: string): number {
  return Math.round((Date.parse(`${last}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) / 86_400_000) + 1;
}

export const brDate = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;

function isDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function span(firstDay: string, lastDay: string): DaySpan {
  const days: string[] = [];
  for (let day = firstDay; day <= lastDay; day = shiftDay(day, 1)) days.push(day);
  return {
    firstDay,
    lastDay,
    start: localDayStart(firstDay).toISOString(),
    end: localDayStart(shiftDay(lastDay, 1)).toISOString(),
    days,
    label: firstDay === lastDay ? brDate(firstDay) : `${brDate(firstDay)} a ${brDate(lastDay)}`,
  };
}

export function isAnalyticsRange(value: unknown): value is AnalyticsRange {
  return typeof value === "string" && value in ANALYTICS_RANGES;
}

/**
 * From `?periodo=&de=&ate=`. Anything unreadable falls back to the last 7
 * days. A custom period is clamped to today, put in order if typed
 * backwards, and limited to MAX_CUSTOM_DAYS (its start moves).
 */
export function resolveAnalyticsPeriod(
  params: { periodo?: string; de?: string; ate?: string },
  now: Date = new Date(),
): AnalyticsPeriod {
  const today = localToday(now);
  let range: AnalyticsRange = isAnalyticsRange(params.periodo) ? params.periodo : "7d";
  let firstDay: string;
  let lastDay = today;

  switch (range) {
    case "hoje":
      firstDay = today;
      break;
    case "ontem":
      firstDay = lastDay = shiftDay(today, -1);
      break;
    case "30d":
      firstDay = shiftDay(today, -29);
      break;
    case "personalizado": {
      if (!isDay(params.de) || !isDay(params.ate)) {
        range = "7d";
        firstDay = shiftDay(today, -6);
        break;
      }
      let [a, b] = [params.de, params.ate].sort();
      if (b > today) b = today;
      if (a > today) a = today;
      if (dayCount(a, b) > MAX_CUSTOM_DAYS) a = shiftDay(b, -(MAX_CUSTOM_DAYS - 1));
      firstDay = a;
      lastDay = b;
      break;
    }
    default:
      firstDay = shiftDay(today, -6);
  }

  const length = dayCount(firstDay, lastDay);
  const previousLast = shiftDay(firstDay, -1);
  return {
    ...span(firstDay, lastDay),
    range,
    previous: span(shiftDay(previousLast, -(length - 1)), previousLast),
    includesToday: lastDay === today,
  };
}

/** GA4's `date` dimension ("20261107") → "2026-11-07". */
export function gaDateToDay(value: string): string {
  return /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value;
}

/** Change from `previous` to `current`, as a fraction; null when there is
 * nothing to compare with. */
export function change(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}
