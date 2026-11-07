import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  pemToDer,
  readGa4Config,
  readRows,
  signServiceAccountJwt,
  type RawReport,
} from "@/lib/analytics/ga4-client";
import { overviewRequests, readOverview, readRealtime } from "@/lib/analytics/ga4-data";
import { classifySource, groupSources } from "@/lib/analytics/sources";
import { resolveAnalyticsPeriod } from "@/lib/analytics/period";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const fromB64url = (part: string) => Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64");

describe("configuration", () => {
  it("reads the whole service-account JSON", () => {
    const read = readGa4Config({
      GA4_PROPERTY_ID: "123456789",
      GA4_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: "painel@x.iam.gserviceaccount.com", private_key: privateKey }),
    });
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.config.clientEmail).toBe("painel@x.iam.gserviceaccount.com");
  });

  it("says what is missing; a G- measurement id is not a property id", () => {
    expect(readGa4Config({})).toEqual({ ok: false, missing: ["GA4_PROPERTY_ID", "GA4_SERVICE_ACCOUNT_JSON"] });
    const wrong = readGa4Config({
      GA4_PROPERTY_ID: "G-NPKKW846TD",
      GA4_CLIENT_EMAIL: "a@b.c",
      GA4_PRIVATE_KEY: privateKey,
    });
    expect(wrong).toEqual({ ok: false, missing: ["GA4_PROPERTY_ID"] });
  });

  it("accepts 'properties/123' and a key pasted with literal \\n", () => {
    const read = readGa4Config({
      GA4_PROPERTY_ID: "properties/987",
      GA4_CLIENT_EMAIL: "a@b.c",
      GA4_PRIVATE_KEY: privateKey.replace(/\n/g, "\\n"),
    });
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.config.propertyId).toBe("987");
  });
});

describe("service-account JWT", () => {
  it("is RS256, scoped to read-only Analytics and verifiable with the public key", async () => {
    const jwt = await signServiceAccountJwt(
      { propertyId: "1", clientEmail: "painel@x.iam.gserviceaccount.com", privateKey: privateKey.replace(/\n/g, "\\n") },
      1_800_000_000,
    );
    const [header, claims, signature] = jwt.split(".");
    expect(JSON.parse(fromB64url(header).toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(JSON.parse(fromB64url(claims).toString())).toEqual({
      iss: "painel@x.iam.gserviceaccount.com",
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: 1_800_000_000,
      exp: 1_800_003_600,
    });
    const spki = Buffer.from(publicKey.replace(/-----[^-]+-----|\s/g, ""), "base64");
    const key = await crypto.subtle.importKey("spki", spki, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      fromB64url(signature),
      new TextEncoder().encode(`${header}.${claims}`),
    );
    expect(ok).toBe(true);
    expect(pemToDer(privateKey).length).toBeGreaterThan(1000);
  });
});

describe("traffic sources", () => {
  it("folds Instagram and Facebook variants, keeps other named sources", () => {
    expect(classifySource("l.instagram.com", "referral").label).toBe("Instagram");
    expect(classifySource("ig", "social").label).toBe("Instagram");
    expect(classifySource("m.facebook.com", "referral").label).toBe("Facebook");
    expect(classifySource("google", "organic").label).toBe("Google");
    expect(classifySource("google.com.br", "referral").label).toBe("Google");
    expect(classifySource("(direct)", "(none)").label).toBe("Acesso direto");
    expect(classifySource("bing", "organic").label).toBe("bing");
  });

  it("groups and sums, then folds the long tail", () => {
    const rows = [
      { source: "instagram.com", medium: "referral", sessions: 10, users: 8 },
      { source: "l.instagram.com", medium: "referral", sessions: 5, users: 5 },
      { source: "(direct)", medium: "(none)", sessions: 12, users: 10 },
      ...["a", "b", "c", "d", "e", "f", "g", "h"].map((s, i) => ({ source: `${s}.com`, medium: "referral", sessions: i + 1, users: 1 })),
    ];
    const grouped = groupSources(rows, 5);
    expect(grouped[0]).toMatchObject({ label: "Instagram", sessions: 15 });
    expect(grouped[1]).toMatchObject({ label: "Acesso direto", sessions: 12 });
    expect(grouped).toHaveLength(5);
    expect(grouped.at(-1)!.label).toBe("Outras fontes");
    const total = grouped.reduce((sum, g) => sum + g.sessions, 0);
    expect(total).toBe(rows.reduce((sum, r) => sum + r.sessions, 0));
  });
});

const NOW = new Date("2026-11-07T01:30:00.000Z");
const period = resolveAnalyticsPeriod({ periodo: "7d" }, NOW);

function report(dims: string[], metrics: string[], rows: [string[], number[]][], totals?: number[]): RawReport {
  return {
    dimensionHeaders: dims.map((name) => ({ name })),
    metricHeaders: metrics.map((name) => ({ name })),
    rows: rows.map(([d, m]) => ({
      dimensionValues: d.map((value) => ({ value })),
      metricValues: m.map((value) => ({ value: String(value) })),
    })),
    totals: totals ? [{ metricValues: totals.map((value) => ({ value: String(value) })) }] : undefined,
  };
}

describe("GA4 reports → panel", () => {
  it("asks within the API's limits", () => {
    const requests = overviewRequests(period);
    expect(requests.length).toBeLessThanOrEqual(5);
    expect(requests[0].dateRanges).toEqual([
      { startDate: "2026-10-31", endDate: "2026-11-06", name: "atual" },
      { startDate: "2026-10-24", endDate: "2026-10-30", name: "anterior" },
    ]);
  });

  it("reads totals, events per period, daily rows with gaps, items and sources", () => {
    const overview = readOverview(period, [
      report(["dateRange"], ["totalUsers", "sessions", "screenPageViews"], [
        [["atual"], [120, 150, 900]],
        [["anterior"], [100, 130, 700]],
      ]),
      report(["eventName", "dateRange"], ["eventCount"], [
        [["view_item", "atual"], [300]],
        [["add_to_cart", "atual"], [40]],
        [["click_whatsapp", "atual"], [25]],
        [["view_item", "anterior"], [250]],
        [["session_start", "atual"], [999]],
      ]),
      report(["date"], ["totalUsers", "sessions"], [
        [["20261101"], [20, 25]],
        [["20261106"], [30, 40]],
      ]),
      report(["itemId", "itemName"], ["itemsViewed", "itemsAddedToCart"], [
        [["p1", "Moletom Coroa"], [80, 12]],
        [["(not set)", "(not set)"], [5, 0]],
      ], [85, 19]),
      report(["sessionSource", "sessionMedium"], ["sessions", "totalUsers"], [
        [["google", "organic"], [60, 50]],
        [["(direct)", "(none)"], [40, 35]],
      ]),
    ]);
    expect(overview.current).toMatchObject({ users: 120, sessions: 150, pageViews: 900 });
    expect(overview.previous.users).toBe(100);
    expect(overview.current.events).toEqual({
      view_item: 300,
      add_to_cart: 40,
      begin_checkout: 0,
      purchase: 0,
      click_whatsapp: 25,
    });
    expect(overview.previous.events.view_item).toBe(250);
    expect(overview.daily).toHaveLength(7);
    expect(overview.daily.find((d) => d.day === "2026-11-01")).toEqual({ day: "2026-11-01", users: 20, sessions: 25 });
    expect(overview.daily.find((d) => d.day === "2026-11-02")).toEqual({ day: "2026-11-02", users: 0, sessions: 0 });
    expect(overview.topProducts).toEqual([{ id: "p1", name: "Moletom Coroa", views: 80, addedToCart: 12 }]);
    expect(overview.itemsAddedToCart).toBe(19);
    expect(overview.sources.map((s) => s.label)).toEqual(["Google", "Acesso direto"]);
  });

  it("an empty answer is zeros and empty lists — never invented numbers", () => {
    const overview = readOverview(period, [{}, {}, {}, {}, {}]);
    expect(overview.current.users).toBe(0);
    expect(overview.topProducts).toEqual([]);
    expect(overview.daily.every((d) => d.users === 0)).toBe(true);
  });

  it("realtime: 5 and 30 minutes, a full minute strip, product views from view_item", () => {
    const rt = readRealtime(
      {
        last5: report([], ["activeUsers"], [[[], [3]]]),
        last30: report([], ["activeUsers", "screenPageViews"], [[[], [11, 47]]]),
        perMinute: report(["minutesAgo"], ["activeUsers"], [
          [["00"], [3]],
          [["07"], [2]],
        ]),
        events: report(["eventName"], ["eventCount"], [
          [["page_view"], [47]],
          [["view_item"], [19]],
        ]),
        pages: report(["unifiedScreenName"], ["screenPageViews", "activeUsers"], [[["Moletom Coroa — King Store"], [9, 4]]]),
        locations: report(["country", "city"], ["activeUsers"], [
          [["Brazil", "Teresina"], [6]],
          [["Brazil", "(not set)"], [2]],
          [["(not set)", "(not set)"], [1]],
        ]),
        devices: report(["deviceCategory"], ["activeUsers"], [[["mobile"], [9]]]),
        sourcesToday: null,
      },
      NOW,
    );
    expect([rt.active5, rt.active30, rt.pageViews30, rt.productViews30]).toEqual([3, 11, 47, 19]);
    expect(rt.perMinute).toHaveLength(30);
    expect(rt.perMinute[0].minutesAgo).toBe(29);
    expect(rt.perMinute.at(-1)).toEqual({ minutesAgo: 0, users: 3 });
    expect(rt.perMinute.find((m) => m.minutesAgo === 7)!.users).toBe(2);
    expect(rt.locations).toEqual([
      { country: "Brazil", city: "Teresina", users: 6 },
      { country: "Brazil", city: "", users: 2 },
    ]);
    expect(rt.sourcesToday).toEqual([]);
  });

  it("realtime with nobody on the site", () => {
    const empty: RawReport = {};
    const rt = readRealtime(
      { last5: empty, last30: empty, perMinute: empty, events: empty, pages: empty, locations: empty, devices: empty, sourcesToday: empty },
      NOW,
    );
    expect(rt.active5).toBe(0);
    expect(rt.perMinute.every((m) => m.users === 0)).toBe(true);
  });

  it("readRows maps headers to names", () => {
    expect(readRows(report(["a"], ["m"], [[["x"], [2]]]))).toEqual([{ dims: { a: "x" }, metrics: { m: 2 } }]);
  });
});
