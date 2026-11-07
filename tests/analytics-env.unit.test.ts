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
    },
  }),
}));

const { readGa4Config } = await import("@/lib/analytics/ga4-client");

describe("readGa4Config in the Worker", () => {
  it("finds non-text bindings that never reach process.env", () => {
    expect(process.env.GA4_PROPERTY_ID).toBeUndefined();
    const read = readGa4Config();
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.config.propertyId).toBe("563146303");
  });
});
