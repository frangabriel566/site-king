import { describe, expect, it, vi } from "vitest";

// A name saved with a stray space or a hyphen in the dashboard.
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: { "GA4_PROPERTY_ID ": "563146303", "ga4-property-id-old": "x" } }),
}));

const { readGa4Config } = await import("@/lib/analytics/ga4-client");

describe("variable names typed slightly differently", () => {
  it("still finds a single near match, without guessing between two", () => {
    const read = readGa4Config();
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.missing).toEqual(["GA4_SERVICE_ACCOUNT_JSON"]);
  });
});
