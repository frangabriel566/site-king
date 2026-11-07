import { describe, expect, it } from "vitest";
import { change, gaDateToDay, resolveAnalyticsPeriod } from "@/lib/analytics/period";

// 07/11/2026 01:30 UTC = 06/11/2026 22:30 in the store (UTC-3).
const NOW = new Date("2026-11-07T01:30:00.000Z");

describe("resolveAnalyticsPeriod", () => {
  it("hoje is the store's day, not UTC's", () => {
    const p = resolveAnalyticsPeriod({ periodo: "hoje" }, NOW);
    expect(p.firstDay).toBe("2026-11-06");
    expect(p.lastDay).toBe("2026-11-06");
    expect(p.start).toBe("2026-11-06T03:00:00.000Z");
    expect(p.end).toBe("2026-11-07T03:00:00.000Z");
    expect(p.includesToday).toBe(true);
    expect(p.previous.firstDay).toBe("2026-11-05");
  });

  it("ontem, compared with the day before", () => {
    const p = resolveAnalyticsPeriod({ periodo: "ontem" }, NOW);
    expect([p.firstDay, p.lastDay]).toEqual(["2026-11-05", "2026-11-05"]);
    expect([p.previous.firstDay, p.previous.lastDay]).toEqual(["2026-11-04", "2026-11-04"]);
    expect(p.includesToday).toBe(false);
  });

  it("7 and 30 days end today and compare with the same length before", () => {
    const week = resolveAnalyticsPeriod({ periodo: "7d" }, NOW);
    expect(week.days).toHaveLength(7);
    expect(week.firstDay).toBe("2026-10-31");
    expect([week.previous.firstDay, week.previous.lastDay]).toEqual(["2026-10-24", "2026-10-30"]);

    const month = resolveAnalyticsPeriod({ periodo: "30d" }, NOW);
    expect(month.days).toHaveLength(30);
    expect(month.previous.days).toHaveLength(30);
    expect(month.previous.end).toBe(month.start);
  });

  it("custom: in order, clamped to today, invalid falls back to 7 days", () => {
    const p = resolveAnalyticsPeriod({ periodo: "personalizado", de: "2026-11-30", ate: "2026-10-01" }, NOW);
    expect([p.firstDay, p.lastDay]).toEqual(["2026-10-01", "2026-11-06"]);
    expect(p.range).toBe("personalizado");
    expect(p.label).toBe("01/10/2026 a 06/11/2026");

    const broken = resolveAnalyticsPeriod({ periodo: "personalizado", de: "2026-02-30", ate: "x" }, NOW);
    expect(broken.range).toBe("7d");

    const junk = resolveAnalyticsPeriod({ periodo: "qualquer" }, NOW);
    expect(junk.range).toBe("7d");
  });

  it("custom periods are capped at 400 days", () => {
    const p = resolveAnalyticsPeriod({ periodo: "personalizado", de: "2020-01-01", ate: "2026-11-06" }, NOW);
    expect(p.days).toHaveLength(400);
    expect(p.lastDay).toBe("2026-11-06");
  });
});

describe("helpers", () => {
  it("GA4 dates", () => {
    expect(gaDateToDay("20261107")).toBe("2026-11-07");
  });

  it("change", () => {
    expect(change(150, 100)).toBe(0.5);
    expect(change(0, 0)).toBe(0);
    expect(change(5, 0)).toBeNull();
  });
});
