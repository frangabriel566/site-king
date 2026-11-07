import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

/**
 * In the Worker the variables come from the Cloudflare bindings. OpenNext
 * copies only text bindings into process.env, so the panel reads the
 * bindings themselves — a variable saved as type JSON must still count.
 */

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({
    env: {
      GA4_PROPERTY_ID: 563146303,
      GA4_SERVICE_ACCOUNT_JSON: { client_email: "painel@x.iam.gserviceaccount.com", private_key: privateKey },
      DB: new (class D1 {})(),
      BETTER_AUTH_SECRET: "nao-mostrar-isto",
    },
  }),
}));

const { describeBindings, readGa4Config } = await import("@/lib/analytics/ga4-client");

describe("readGa4Config in the Worker", () => {
  it("finds non-text bindings that never reach process.env", () => {
    expect(process.env.GA4_PROPERTY_ID).toBeUndefined();
    const read = readGa4Config();
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.config.propertyId).toBe("563146303");
  });

  it("describes the bindings by name and kind, never by value", () => {
    const described = describeBindings();
    expect(described).toEqual([
      { name: "BETTER_AUTH_SECRET", kind: "texto" },
      { name: "DB", kind: "outro" },
      { name: "GA4_PROPERTY_ID", kind: "número" },
      { name: "GA4_SERVICE_ACCOUNT_JSON", kind: "objeto" },
    ]);
    expect(JSON.stringify(described)).not.toContain("nao-mostrar");
    expect(JSON.stringify(described)).not.toContain("PRIVATE KEY");
  });
});
