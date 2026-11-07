import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Painel → Analytics → Tempo real: the endpoint the page polls answers only
 * an admin. A visitor, or a signed-in customer, gets a 401 and no numbers —
 * and GA4 is never even asked.
 */

const state = vi.hoisted(() => ({ role: null as null | "admin" | "customer", gaCalls: 0 }));

vi.mock("@/lib/auth/guards", () => {
  class AdminAuthError extends Error {}
  return {
    AdminAuthError,
    requireAdmin: async () => {
      if (state.role === null) throw new AdminAuthError("UNAUTHORIZED");
      if (state.role !== "admin") throw new AdminAuthError("FORBIDDEN");
      return { id: "u1", email: "admin@loja.com", name: "", role: "admin" };
    },
  };
});
vi.mock("@/lib/analytics/ga4-data", () => ({
  getGaRealtime: async () => {
    state.gaCalls += 1;
    return { status: { ok: true }, data: { active5: 3 } };
  },
}));

const { GET } = await import("@/app/(admin)/admin/(dashboard)/analytics/tempo-real/route");

beforeEach(() => {
  state.gaCalls = 0;
});

describe("GET /admin/analytics/tempo-real", () => {
  it("refuses a visitor without a session", async () => {
    state.role = null;
    const response = await GET();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Não autorizado" });
    expect(state.gaCalls).toBe(0);
  });

  it("refuses a signed-in customer", async () => {
    state.role = "customer";
    expect((await GET()).status).toBe(401);
    expect(state.gaCalls).toBe(0);
  });

  it("answers an admin, never cached", async () => {
    state.role = "admin";
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ data: { active5: 3 } });
  });
});
