/**
 * The period the "Vendas na loja" dashboard looks at — a day, a month or a
 * year, in the store's own clock.
 *
 * Timestamps are UTC in the database and the Worker runs in UTC, so "today"
 * has to be worked out on purpose: a sale rung up at 22:00 in the store is
 * already tomorrow in UTC. Brazil dropped daylight saving in 2019, so the
 * store's clock is a fixed UTC-3 — one offset, used the same way here and in
 * SQL (`LOCAL_SQL_MODIFIER`), so the cards, the chart and the list always
 * agree on where a day starts.
 *
 * No `server-only`: the filter bar (a Client Component) uses it too.
 */

export const LOCAL_OFFSET = "-03:00";
const OFFSET_MS = 3 * 60 * 60 * 1000;
/** For SQLite's date functions: `strftime(fmt, created_at, '-3 hours')`. */
export const LOCAL_SQL_MODIFIER = "-3 hours";

export const PERIOD_MODES = ["dia", "mes", "ano"] as const;
export type PeriodMode = (typeof PERIOD_MODES)[number];

export const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export type Period = {
  mode: PeriodMode;
  /** "2026-10-26", "2026-10" or "2026". */
  key: string;
  /** "26 de outubro de 2026", "outubro de 2026", "2026". */
  label: string;
  /** UTC ISO bounds, start inclusive, end exclusive. */
  start: string;
  end: string;
  prev: string;
  /** Null when the next period hasn't started yet. */
  next: string | null;
  /** The chart's columns: hours of the day, days of the month or months. */
  buckets: { key: string; label: string }[];
  /** The `strftime` format that turns a local timestamp into a bucket key. */
  bucketFormat: "%H" | "%Y-%m-%d" | "%Y-%m";
};

const pad = (n: number) => String(n).padStart(2, "0");

/** The store's local date and time for a UTC instant, as "YYYY-MM-DDTHH:MM…". */
export function localIso(value: string | Date = new Date()): string {
  const ms = typeof value === "string" ? Date.parse(value) : value.getTime();
  return new Date(ms - OFFSET_MS).toISOString();
}

/** "2026-10-26" in the store's clock. */
export function localToday(now: Date = new Date()): string {
  return localIso(now).slice(0, 10);
}

/** The UTC instant at which a local date (YYYY-MM-DD) starts. */
export function localDayStart(day: string): Date {
  return new Date(`${day}T00:00:00.000${LOCAL_OFFSET}`);
}

/** Start of the local day and month containing `now`, as UTC Dates. */
export function localBounds(now: Date = new Date()): { dayStart: Date; monthStart: Date } {
  const today = localToday(now);
  return { dayStart: localDayStart(today), monthStart: localDayStart(`${today.slice(0, 7)}-01`) };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

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

function isValidKey(mode: PeriodMode, key: string): boolean {
  if (mode === "ano") return /^\d{4}$/.test(key) && Number(key) >= 2000 && Number(key) <= 2100;
  if (mode === "mes") {
    if (!/^\d{4}-\d{2}$/.test(key)) return false;
    const month = Number(key.slice(5));
    return month >= 1 && month <= 12 && isValidKey("ano", key.slice(0, 4));
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !isValidKey("mes", key.slice(0, 7))) return false;
  const day = Number(key.slice(8));
  return day >= 1 && day <= daysInMonth(Number(key.slice(0, 4)), Number(key.slice(5, 7)));
}

export function isPeriodMode(value: unknown): value is PeriodMode {
  return typeof value === "string" && (PERIOD_MODES as readonly string[]).includes(value);
}

/** The current period's key for a mode: today, this month or this year. */
export function currentKey(mode: PeriodMode, now: Date = new Date()): string {
  const today = localToday(now);
  return mode === "dia" ? today : mode === "mes" ? today.slice(0, 7) : today.slice(0, 4);
}

export function periodLabel(mode: PeriodMode, key: string): string {
  if (mode === "ano") return key;
  const month = MONTH_NAMES[Number(key.slice(5, 7)) - 1];
  if (mode === "mes") return `${month} de ${key.slice(0, 4)}`;
  return `${Number(key.slice(8))} de ${month} de ${key.slice(0, 4)}`;
}

/**
 * The period from the page's `?periodo=&data=`. Anything unreadable falls
 * back to the current month — the view the store opens most.
 */
export function resolvePeriod(
  params: { periodo?: string; data?: string },
  now: Date = new Date(),
): Period {
  const mode: PeriodMode = isPeriodMode(params.periodo) ? params.periodo : "mes";
  const key = params.data && isValidKey(mode, params.data) ? params.data : currentKey(mode, now);
  const current = currentKey(mode, now);

  let startDay: string;
  let endDay: string;
  let prev: string;
  let next: string;
  let buckets: Period["buckets"];
  let bucketFormat: Period["bucketFormat"];

  if (mode === "dia") {
    startDay = key;
    endDay = shiftDay(key, 1);
    prev = shiftDay(key, -1);
    next = endDay;
    buckets = Array.from({ length: 24 }, (_, hour) => ({ key: pad(hour), label: `${pad(hour)}h` }));
    bucketFormat = "%H";
  } else if (mode === "mes") {
    startDay = `${key}-01`;
    next = shiftMonth(key, 1);
    endDay = `${next}-01`;
    prev = shiftMonth(key, -1);
    const days = daysInMonth(Number(key.slice(0, 4)), Number(key.slice(5, 7)));
    buckets = Array.from({ length: days }, (_, i) => ({
      key: `${key}-${pad(i + 1)}`,
      label: String(i + 1),
    }));
    bucketFormat = "%Y-%m-%d";
  } else {
    startDay = `${key}-01-01`;
    next = String(Number(key) + 1);
    endDay = `${next}-01-01`;
    prev = String(Number(key) - 1);
    buckets = MONTH_NAMES.map((name, i) => ({ key: `${key}-${pad(i + 1)}`, label: name.slice(0, 3) }));
    bucketFormat = "%Y-%m";
  }

  return {
    mode,
    key,
    label: periodLabel(mode, key),
    start: localDayStart(startDay).toISOString(),
    end: localDayStart(endDay).toISOString(),
    prev,
    // Keys of one mode compare as text, oldest first.
    next: next > current ? null : next,
    buckets,
    bucketFormat,
  };
}

/** "26/10/2026 14:05" in the store's clock (the panel's other dates are
 * formatted in the Worker's UTC). */
export function formatLocalDateTime(iso: string): string {
  const local = localIso(iso);
  return `${local.slice(8, 10)}/${local.slice(5, 7)}/${local.slice(0, 4)} ${local.slice(11, 16)}`;
}
