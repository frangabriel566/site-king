import "server-only";
import {
  Ga4Error,
  batchRunReports,
  cached,
  readGa4Config,
  readRows,
  runRealtimeReport,
  runReport,
  type Ga4Config,
  type Ga4Status,
  type RawReport,
  type ReportRequest,
} from "./ga4-client";
import { gaDateToDay, type AnalyticsPeriod } from "./period";
import { groupSources, type TrafficSource } from "./sources";

/**
 * What the Analytics page asks GA4. Two kinds of numbers, never mixed up:
 *
 * - consolidated (Data API runReport): the chosen period. GA4 processes
 *   these with a delay — usually minutes to a few hours, up to 24-48h for
 *   some data — so today's figures still grow;
 * - realtime (runRealtimeReport): the last 30 minutes, refreshed by the
 *   page every minute. GA4 has no traffic source or item name in realtime.
 *
 * Sales and revenue do not come from here: the orders table is the source
 * for those (lib/analytics/store-data.ts).
 */

export const TRACKED_EVENTS = [
  "view_item",
  "add_to_cart",
  "begin_checkout",
  "purchase",
  "click_whatsapp",
] as const;
export type TrackedEvent = (typeof TRACKED_EVENTS)[number];

type Totals = {
  users: number;
  sessions: number;
  pageViews: number;
  events: Record<TrackedEvent, number>;
};

export type GaOverview = {
  current: Totals;
  previous: Totals;
  /** One per day of the period, zeros included. */
  daily: { day: string; users: number; sessions: number }[];
  topProducts: { id: string; name: string; views: number; addedToCart: number }[];
  /** Items added to the bag in the period (all products). */
  itemsAddedToCart: number;
  sources: TrafficSource[];
  /** click_whatsapp by spot. Null when the custom dimension isn't
   * registered in GA4 yet (the rest of the report still works). */
  whatsappByLocation: { location: string; clicks: number }[] | null;
};

export type GaResult<T> = { status: Ga4Status; data: T | null };

function failure(error: unknown): Ga4Status {
  if (error instanceof Ga4Error) return { ok: false, reason: "error", message: error.message };
  return {
    ok: false,
    reason: "error",
    message: "Não foi possível falar com o Google Analytics agora. Tente de novo em instantes.",
  };
}

function config(): { config: Ga4Config } | { status: Ga4Status } {
  const read = readGa4Config();
  if (!read.ok) {
    return { status: { ok: false, reason: "not_configured", missing: read.missing, problems: read.problems } };
  }
  return { config: read.config };
}

const eventFilter = {
  filter: { fieldName: "eventName", inListFilter: { values: [...TRACKED_EVENTS] } },
};

function emptyTotals(): Totals {
  return {
    users: 0,
    sessions: 0,
    pageViews: 0,
    events: Object.fromEntries(TRACKED_EVENTS.map((e) => [e, 0])) as Record<TrackedEvent, number>,
  };
}

/** The requests, one batch (GA4 allows 5 per call). Exported for tests. */
export function overviewRequests(period: AnalyticsPeriod): ReportRequest[] {
  const both = [
    { startDate: period.firstDay, endDate: period.lastDay, name: "atual" },
    { startDate: period.previous.firstDay, endDate: period.previous.lastDay, name: "anterior" },
  ];
  const current = [{ startDate: period.firstDay, endDate: period.lastDay }];
  return [
    { metrics: [{ name: "totalUsers" }, { name: "sessions" }, { name: "screenPageViews" }], dateRanges: both },
    {
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dateRanges: both,
      dimensionFilter: eventFilter,
    },
    {
      dimensions: [{ name: "date" }],
      metrics: [{ name: "totalUsers" }, { name: "sessions" }],
      dateRanges: current,
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: 500,
    },
    {
      dimensions: [{ name: "itemId" }, { name: "itemName" }],
      metrics: [{ name: "itemsViewed" }, { name: "itemsAddedToCart" }],
      dateRanges: current,
      orderBys: [{ metric: { metricName: "itemsViewed" }, desc: true }],
      limit: 10,
      metricAggregations: ["TOTAL"],
    },
    {
      dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      dateRanges: current,
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 100,
    },
  ];
}

/** GA4's answer → the panel's shape. Exported for tests. */
export function readOverview(period: AnalyticsPeriod, reports: RawReport[]): Omit<GaOverview, "whatsappByLocation"> {
  const [totalsReport, eventsReport, dailyReport, itemsReport, sourcesReport] = reports;
  const current = emptyTotals();
  const previous = emptyTotals();
  const pick = (range: string | undefined) => (range === "anterior" ? previous : current);

  for (const row of readRows(totalsReport ?? {})) {
    const target = pick(row.dims.dateRange);
    target.users = row.metrics.totalUsers ?? 0;
    target.sessions = row.metrics.sessions ?? 0;
    target.pageViews = row.metrics.screenPageViews ?? 0;
  }
  for (const row of readRows(eventsReport ?? {})) {
    const name = row.dims.eventName as TrackedEvent;
    if (TRACKED_EVENTS.includes(name)) pick(row.dims.dateRange).events[name] = row.metrics.eventCount ?? 0;
  }

  const byDay = new Map(
    readRows(dailyReport ?? {}).map((row) => [
      gaDateToDay(row.dims.date),
      { users: row.metrics.totalUsers ?? 0, sessions: row.metrics.sessions ?? 0 },
    ]),
  );
  const daily = period.days.map((day) => ({ day, ...(byDay.get(day) ?? { users: 0, sessions: 0 }) }));

  const topProducts = readRows(itemsReport ?? {})
    .filter((row) => row.dims.itemName && row.dims.itemName !== "(not set)")
    .map((row) => ({
      id: row.dims.itemId,
      name: row.dims.itemName,
      views: row.metrics.itemsViewed ?? 0,
      addedToCart: row.metrics.itemsAddedToCart ?? 0,
    }));
  const itemTotals = readRows(itemsReport ?? {}, "totals")[0];

  const sources = groupSources(
    readRows(sourcesReport ?? {}).map((row) => ({
      source: row.dims.sessionSource,
      medium: row.dims.sessionMedium,
      sessions: row.metrics.sessions ?? 0,
      users: row.metrics.totalUsers ?? 0,
    })),
  );

  return {
    current,
    previous,
    daily,
    topProducts,
    itemsAddedToCart: itemTotals?.metrics.itemsAddedToCart ?? 0,
    sources,
  };
}

export async function getGaOverview(period: AnalyticsPeriod): Promise<GaResult<GaOverview>> {
  const setup = config();
  if ("status" in setup) return { status: setup.status, data: null };
  const key = `overview:${period.firstDay}:${period.lastDay}`;
  // Consolidated data moves slowly: 5 minutes is plenty, 2 when it holds today.
  const ttl = period.includesToday ? 120_000 : 300_000;
  try {
    const data = await cached(key, ttl, async () => {
      const [reports, whatsapp] = await Promise.all([
        batchRunReports(setup.config, overviewRequests(period)),
        // Needs link_location registered as a custom dimension; its own
        // call so a missing dimension doesn't take the page down.
        runReport(setup.config, {
          dimensions: [{ name: "customEvent:link_location" }],
          metrics: [{ name: "eventCount" }],
          dateRanges: [{ startDate: period.firstDay, endDate: period.lastDay }],
          dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { value: "click_whatsapp" } } },
          orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
          limit: 20,
        }).catch(() => null),
      ]);
      return {
        ...readOverview(period, reports),
        whatsappByLocation: whatsapp
          ? readRows(whatsapp).map((row) => ({
              location: row.dims["customEvent:link_location"],
              clicks: row.metrics.eventCount ?? 0,
            }))
          : null,
      };
    });
    return { status: { ok: true }, data };
  } catch (error) {
    return { status: failure(error), data: null };
  }
}

// --- Realtime ---------------------------------------------------------------

export type GaRealtime = {
  /** activeUsers over the last 5 and 30 minutes. */
  active5: number;
  active30: number;
  pageViews30: number;
  productViews30: number;
  /** Active users per minute, oldest first (29 → 0 minutes ago). */
  perMinute: { minutesAgo: number; users: number }[];
  events: { name: string; count: number }[];
  pages: { title: string; views: number; users: number }[];
  locations: { country: string; city: string; users: number }[];
  devices: { device: string; users: number }[];
  /** Today's sources (consolidated: may lag behind the realtime numbers). */
  sourcesToday: TrafficSource[];
  fetchedAt: string;
};

const LAST_30 = [{ startMinutesAgo: 29, endMinutesAgo: 0 }];

/** Exported for tests. */
export function readRealtime(
  reports: {
    last5: RawReport;
    last30: RawReport;
    perMinute: RawReport;
    events: RawReport;
    pages: RawReport;
    locations: RawReport;
    devices: RawReport;
    sourcesToday: RawReport | null;
  },
  now: Date,
): GaRealtime {
  // No dimensions: one row (or none, when nobody is on the site).
  const last5 = readRows(reports.last5)[0]?.metrics;
  const last30 = readRows(reports.last30)[0]?.metrics;
  const active5 = last5?.activeUsers ?? 0;
  const active30 = last30?.activeUsers ?? 0;
  const pageViews30 = last30?.screenPageViews ?? 0;

  const minutes = new Map(
    readRows(reports.perMinute).map((row) => [Number(row.dims.minutesAgo), row.metrics.activeUsers ?? 0]),
  );
  const perMinute = Array.from({ length: 30 }, (_, i) => 29 - i).map((m) => ({
    minutesAgo: m,
    users: minutes.get(m) ?? 0,
  }));

  const events = readRows(reports.events).map((row) => ({
    name: row.dims.eventName,
    count: row.metrics.eventCount ?? 0,
  }));

  return {
    active5,
    active30,
    pageViews30,
    productViews30: events.find((e) => e.name === "view_item")?.count ?? 0,
    perMinute,
    events,
    pages: readRows(reports.pages).map((row) => ({
      title: row.dims.unifiedScreenName,
      views: row.metrics.screenPageViews ?? 0,
      users: row.metrics.activeUsers ?? 0,
    })),
    locations: readRows(reports.locations)
      .filter((row) => row.dims.country && row.dims.country !== "(not set)")
      .map((row) => ({
        country: row.dims.country,
        city: row.dims.city === "(not set)" ? "" : row.dims.city,
        users: row.metrics.activeUsers ?? 0,
      })),
    devices: readRows(reports.devices).map((row) => ({
      device: row.dims.deviceCategory,
      users: row.metrics.activeUsers ?? 0,
    })),
    sourcesToday: reports.sourcesToday
      ? groupSources(
          readRows(reports.sourcesToday).map((row) => ({
            source: row.dims.sessionSource,
            medium: row.dims.sessionMedium,
            sessions: row.metrics.sessions ?? 0,
            users: row.metrics.totalUsers ?? 0,
          })),
          6,
        )
      : [],
    fetchedAt: now.toISOString(),
  };
}

export async function getGaRealtime(today: string): Promise<GaResult<GaRealtime>> {
  const setup = config();
  if ("status" in setup) return { status: setup.status, data: null };
  const c = setup.config;
  try {
    // 30 s: the page asks every minute; two admins open share one answer.
    const data = await cached("realtime", 30_000, async () => {
      const [last5, last30, perMinute, events, pages, locations, devices, sourcesToday] = await Promise.all([
        runRealtimeReport(c, {
          metrics: [{ name: "activeUsers" }],
          minuteRanges: [{ startMinutesAgo: 4, endMinutesAgo: 0 }],
        }),
        runRealtimeReport(c, {
          metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
          minuteRanges: LAST_30,
        }),
        runRealtimeReport(c, {
          dimensions: [{ name: "minutesAgo" }],
          metrics: [{ name: "activeUsers" }],
          minuteRanges: LAST_30,
          limit: 30,
        }),
        runRealtimeReport(c, {
          dimensions: [{ name: "eventName" }],
          metrics: [{ name: "eventCount" }],
          minuteRanges: LAST_30,
          orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
          limit: 15,
        }),
        runRealtimeReport(c, {
          dimensions: [{ name: "unifiedScreenName" }],
          metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
          minuteRanges: LAST_30,
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: 8,
        }),
        runRealtimeReport(c, {
          dimensions: [{ name: "country" }, { name: "city" }],
          metrics: [{ name: "activeUsers" }],
          minuteRanges: LAST_30,
          orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
          limit: 8,
        }),
        runRealtimeReport(c, {
          dimensions: [{ name: "deviceCategory" }],
          metrics: [{ name: "activeUsers" }],
          minuteRanges: LAST_30,
        }),
        // Realtime has no source: today's consolidated one, kept longer.
        cached(`sources-today:${today}`, 300_000, () =>
          runReport(c, {
            dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
            metrics: [{ name: "sessions" }, { name: "totalUsers" }],
            dateRanges: [{ startDate: today, endDate: today }],
            orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
            limit: 50,
          }),
        ).catch(() => null),
      ]);
      return readRealtime({ last5, last30, perMinute, events, pages, locations, devices, sourcesToday }, new Date());
    });
    return { status: { ok: true }, data };
  } catch (error) {
    return { status: failure(error), data: null };
  }
}
