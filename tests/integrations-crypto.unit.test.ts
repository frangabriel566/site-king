import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  IntegrationKeyMissingError,
  decryptSecrets,
  encryptSecrets,
  isEncryptionKeyConfigured,
  secretHint,
} from "@/lib/integrations/crypto";

const KEY = Buffer.alloc(32, 7).toString("base64");

describe("integration secrets at rest", () => {
  beforeEach(() => {
    process.env.INTEGRATIONS_KEY = KEY;
  });
  afterEach(() => {
    delete process.env.INTEGRATIONS_KEY;
  });

  it("encrypts so the token is not in the stored text, and decrypts back", async () => {
    const token = "APP_USR-1234567890-abcdefghijklmnop-3f9a";
    const blob = await encryptSecrets("mercadopago", { access_token: token });
    expect(blob).toMatch(/^v1\./);
    expect(blob).not.toContain(token);
    expect(blob).not.toContain("3f9a");
    expect(await decryptSecrets("mercadopago", blob)).toEqual({ access_token: token });
  });

  it("uses a fresh IV every time", async () => {
    const a = await encryptSecrets("mercadopago", { access_token: "x".repeat(30) });
    const b = await encryptSecrets("mercadopago", { access_token: "x".repeat(30) });
    expect(a).not.toBe(b);
  });

  it("refuses a ciphertext moved to the other provider, or tampered with", async () => {
    const blob = await encryptSecrets("mercadopago", { access_token: "y".repeat(30) });
    await expect(decryptSecrets("melhorenvio", blob)).rejects.toThrow();
    const [v, iv, data] = blob.split(".");
    const flipped = `${v}.${iv}.${data.slice(0, -4)}${data.slice(-4) === "AAAA" ? "BBBB" : "AAAA"}`;
    await expect(decryptSecrets("mercadopago", flipped)).rejects.toThrow();
  });

  it("does not decrypt with another key", async () => {
    const blob = await encryptSecrets("melhorenvio", { token: "z".repeat(40) });
    process.env.INTEGRATIONS_KEY = Buffer.alloc(32, 9).toString("base64");
    await expect(decryptSecrets("melhorenvio", blob)).rejects.toThrow();
  });

  it("says when the key is missing or not 32 bytes", async () => {
    delete process.env.INTEGRATIONS_KEY;
    expect(isEncryptionKeyConfigured()).toBe(false);
    await expect(encryptSecrets("mercadopago", { access_token: "t".repeat(30) })).rejects.toBeInstanceOf(
      IntegrationKeyMissingError,
    );
    process.env.INTEGRATIONS_KEY = Buffer.alloc(16, 1).toString("base64");
    expect(isEncryptionKeyConfigured()).toBe(false);
  });

  it("shows only the last 4 characters", () => {
    expect(secretHint("APP_USR-123-3f9a")).toBe("3f9a");
  });
});
