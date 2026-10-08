import { describe, expect, it } from "vitest";
import { planVariantSync, type ExistingVariant, type IncomingVariant } from "@/lib/products/variant-sync";

const row = (id: string, color: string, size: string, archived = false): ExistingVariant => ({
  id,
  color,
  size,
  sku: `SKU-${id}`,
  archived_at: archived ? "2026-01-01T00:00:00.000Z" : null,
});

const incoming = (color: string, size: string, id?: string, stock = 1): IncomingVariant => ({
  id,
  color,
  size,
  color_hex: null,
  sku: id ? `SKU-${id}` : `NEW-${color}-${size}`,
  stock,
  image_url: null,
});

describe("planVariantSync", () => {
  it("keeps the id of a variant saved again (by id or by color + size)", () => {
    const plan = planVariantSync(
      [row("a", "Preto", "M"), row("b", "Preto", "G")],
      [incoming("Preto", "M", "a", 9), incoming("Preto", "G")],
      new Set(),
    );
    expect(plan.updates.map((u) => u.id).sort()).toEqual(["a", "b"]);
    expect(plan.updates.find((u) => u.id === "a")?.values.stock).toBe(9);
    expect(plan.inserts).toEqual([]);
    expect(plan.archive).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it("inserts only the variants that are really new", () => {
    const plan = planVariantSync([row("a", "Preto", "M")], [incoming("Preto", "M", "a"), incoming("Preto", "GG")], new Set());
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0]).toMatchObject({ color: "Preto", size: "GG" });
  });

  it("archives a removed variant that was sold and deletes one that never was", () => {
    const plan = planVariantSync(
      [row("a", "Preto", "M"), row("sold", "Preto", "G"), row("never", "Branco", "G")],
      [incoming("Preto", "M", "a")],
      new Set(["sold"]),
    );
    expect(plan.archive).toEqual(["sold"]);
    expect(plan.remove).toEqual(["never"]);
  });

  it("keeps the id when a color is renamed", () => {
    const plan = planVariantSync([row("a", "Preto", "M")], [incoming("Preto Ônix", "M", "a")], new Set());
    expect(plan.updates).toEqual([
      expect.objectContaining({ id: "a", keyChanged: true, values: expect.objectContaining({ color: "Preto Ônix" }) }),
    ]);
    expect(plan.inserts).toEqual([]);
  });

  it("revives an archived variant when its color + size comes back", () => {
    const plan = planVariantSync([row("old", "Preto", "G", true)], [incoming("Preto", "G")], new Set(["old"]));
    expect(plan.updates).toEqual([expect.objectContaining({ id: "old", restore: true })]);
    expect(plan.inserts).toEqual([]);
  });

  it("prefers the live row over an archived one with the same key", () => {
    // The unique index forbids this pair in the database; the planner must
    // still pick the live one if it ever met it.
    const plan = planVariantSync(
      [row("archived", "Preto", "G", true), row("live", "Preto", "G")],
      [incoming("Preto", "G")],
      new Set(),
    );
    expect(plan.updates[0].id).toBe("live");
  });

  it("moves an archived row aside when a renamed variant takes its key", () => {
    const plan = planVariantSync(
      [row("a", "Branco", "M"), row("old", "Preto", "M", true)],
      [incoming("Preto", "M", "a")],
      new Set(),
    );
    expect(plan.updates[0]).toMatchObject({ id: "a", keyChanged: true });
    expect(plan.freeKey).toEqual(["old"]);
  });

  it("leaves untouched archived rows alone", () => {
    const plan = planVariantSync([row("old", "Preto", "G", true)], [incoming("Preto", "M")], new Set());
    expect(plan.archive).toEqual([]);
    expect(plan.remove).toEqual([]);
    expect(plan.freeKey).toEqual([]);
  });
});
