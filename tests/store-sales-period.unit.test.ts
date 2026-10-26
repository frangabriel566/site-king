import { describe, expect, it } from "vitest";
import { localToday, resolvePeriod } from "@/lib/store-sales/period";
import { buildBirthdayMessage, nextBirthday } from "@/lib/store-sales/birthday";

const NOW = new Date("2026-10-26T15:00:00.000Z");

describe("resolvePeriod", () => {
  it("uses the store's clock for today", () => {
    expect(localToday(new Date("2026-10-27T02:59:00.000Z"))).toBe("2026-10-26");
    expect(localToday(new Date("2026-10-27T03:00:00.000Z"))).toBe("2026-10-27");
  });

  it("defaults to the current month", () => {
    const period = resolvePeriod({}, NOW);
    expect(period).toMatchObject({
      mode: "mes",
      key: "2026-10",
      label: "outubro de 2026",
      start: "2026-10-01T03:00:00.000Z",
      end: "2026-11-01T03:00:00.000Z",
      prev: "2026-09",
      next: null,
    });
    expect(period.buckets).toHaveLength(31);
  });

  it("reads a day, a month and a year", () => {
    expect(resolvePeriod({ periodo: "dia", data: "2026-02-28" }, NOW)).toMatchObject({
      label: "28 de fevereiro de 2026",
      start: "2026-02-28T03:00:00.000Z",
      end: "2026-03-01T03:00:00.000Z",
      prev: "2026-02-27",
      next: "2026-03-01",
    });
    expect(resolvePeriod({ periodo: "mes", data: "2026-01" }, NOW)).toMatchObject({ prev: "2025-12", next: "2026-02" });
    const year = resolvePeriod({ periodo: "ano", data: "2025" }, NOW);
    expect(year).toMatchObject({ start: "2025-01-01T03:00:00.000Z", end: "2026-01-01T03:00:00.000Z", next: "2026" });
    expect(year.buckets.map((b) => b.label)).toEqual(["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]);
  });

  it("falls back on anything unreadable", () => {
    expect(resolvePeriod({ periodo: "dia", data: "2026-02-30" }, NOW).key).toBe("2026-10-26");
    expect(resolvePeriod({ periodo: "semana", data: "2026" }, NOW).key).toBe("2026-10");
  });
});

describe("birthdays", () => {
  it("finds the next birthday and the age", () => {
    expect(nextBirthday("1990-10-26", "2026-10-26")).toEqual({ date: "2026-10-26", daysUntil: 0, turning: 36 });
    expect(nextBirthday("1990-10-25", "2026-10-26")).toEqual({ date: "2027-10-25", daysUntil: 364, turning: 37 });
    expect(nextBirthday("2000-01-02", "2026-12-31")).toEqual({ date: "2027-01-02", daysUntil: 2, turning: 27 });
  });

  it("puts 29/02 on 28/02 outside leap years", () => {
    expect(nextBirthday("2000-02-29", "2027-02-01").date).toBe("2027-02-28");
    expect(nextBirthday("2000-02-29", "2028-02-01").date).toBe("2028-02-29");
  });

  it("fills in the message", () => {
    expect(buildBirthdayMessage("Oi {nome}, presente da {loja}!", { name: "Ana Clara Souza", storeName: "King Store" })).toBe(
      "Oi Ana, presente da King Store!",
    );
    expect(buildBirthdayMessage(null, { name: "Ana", storeName: "King Store" })).toMatch(/^Feliz aniversário, Ana!/);
  });
});
