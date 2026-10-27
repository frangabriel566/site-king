import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { createTestDb } from "./support/d1";

/**
 * Vendas na loja: "Dar baixa" takes the pieces out of stock all-or-nothing,
 * "Desfazer baixa" puts them back exactly once, and the dashboard counts
 * only what wasn't undone, by the store's clock (UTC-3).
 */

const state = vi.hoisted(() => ({ db: null as unknown as Db }));

vi.mock("@/lib/db", async () => ({
  getDb: () => state.db,
  schema: await import("@/lib/db/schema"),
}));
vi.mock("@/lib/auth/guards", () => ({
  getCurrentUser: async () => ({ id: "admin", email: "admin@loja.test", role: "admin" }),
  requireAdmin: async () => ({ id: "admin", email: "admin@loja.test", role: "admin" }),
  requireAdminPage: async () => ({ id: "admin", email: "admin@loja.test", role: "admin" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const {
  createStoreSaleAction,
  updateStoreSaleAction,
  cancelStoreSaleAction,
  deleteStoreSaleAction,
  createStoreCustomerAction,
  markBirthdaySentAction,
} = await import("@/lib/actions/store-sales");
const { getEditableStoreSale, getStoreSalesDashboard, getUpcomingBirthdays, searchStoreProducts } = await import(
  "@/lib/data/store-sales"
);
const { resolvePeriod } = await import("@/lib/store-sales/period");

const { products, product_variants, store_sales, store_sale_items, store_customers, orders } = schema;

const PRODUCT = "aaaaaaaa-2222-4000-a000-000000000001";
const OTHER = "aaaaaaaa-2222-4000-a000-000000000002";
const BLACK_M = "bbbbbbbb-2222-4000-a000-000000000001";
const BLACK_G = "bbbbbbbb-2222-4000-a000-000000000002";
const SHIRT = "bbbbbbbb-2222-4000-a000-000000000003";

let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ db: state.db, dispose } = await createTestDb());
  await state.db.insert(products).values([
    { id: PRODUCT, name: "Moletom King", slug: "moletom-loja", price: 200, status: "active", search_text: "moletom king" },
    { id: OTHER, name: "Camiseta Básica", slug: "camiseta-loja", price: 80, status: "draft", search_text: "camiseta basica" },
  ]);
  await state.db.insert(product_variants).values([
    { id: BLACK_M, product_id: PRODUCT, color: "Preto", size: "M", sku: "MOL-PT-M", stock: 5 },
    { id: BLACK_G, product_id: PRODUCT, color: "Preto", size: "G", stock: 1 },
    { id: SHIRT, product_id: OTHER, color: "Branco", size: "P", stock: 10 },
  ]);
});

afterAll(async () => {
  await dispose?.();
});

beforeEach(async () => {
  await state.db.delete(store_sales);
  await state.db.delete(store_customers);
  await state.db.update(product_variants).set({ archived_at: null });
  await state.db.update(product_variants).set({ stock: 5 }).where(eq(product_variants.id, BLACK_M));
  await state.db.update(product_variants).set({ stock: 1 }).where(eq(product_variants.id, BLACK_G));
  await state.db.update(product_variants).set({ stock: 10 }).where(eq(product_variants.id, SHIRT));
});

async function stock(id: string) {
  const [row] = await state.db.select({ stock: product_variants.stock }).from(product_variants).where(eq(product_variants.id, id));
  return row.stock;
}

function sale(items: { variantId: string; qty: number; unitPrice: number }[], extra: Record<string, unknown> = {}) {
  return createStoreSaleAction({ items, paymentMethod: "pix", discount: 0, ...extra });
}

describe("Dar baixa", () => {
  it("records the sale and takes every piece out of stock", async () => {
    const result = await sale(
      [
        { variantId: BLACK_M, qty: 2, unitPrice: 200 },
        { variantId: SHIRT, qty: 1, unitPrice: 70 },
      ],
      { discount: 20, note: "  cliente antigo  " },
    );
    expect(result).toEqual({ ok: true, message: `Venda #1 registrada: 3 peças baixadas, ${formatCurrency(450)}.` });
    expect(await stock(BLACK_M)).toBe(3);
    expect(await stock(SHIRT)).toBe(9);

    const [row] = await state.db.select().from(store_sales);
    expect(row).toMatchObject({ sale_number: 1, subtotal: 470, discount: 20, total: 450, note: "cliente antigo", created_by: "admin@loja.test" });
    // Never a site order.
    expect(await state.db.select().from(orders)).toHaveLength(0);
  });

  it("numbers sales one after the other", async () => {
    await sale([{ variantId: SHIRT, qty: 1, unitPrice: 80 }]);
    const second = await sale([{ variantId: SHIRT, qty: 1, unitPrice: 80 }]);
    expect(second.message).toMatch(/^Venda #2 /);
  });

  it("changes nothing when a piece is short, and names it", async () => {
    const result = await sale([
      { variantId: BLACK_M, qty: 1, unitPrice: 200 },
      { variantId: BLACK_G, qty: 2, unitPrice: 200 },
    ]);
    expect(result).toEqual({
      ok: false,
      message: "Sem estoque suficiente de Moletom King — Preto · G (resta 1). Nada foi baixado.",
    });
    expect(await stock(BLACK_M)).toBe(5);
    expect(await stock(BLACK_G)).toBe(1);
    expect(await state.db.select().from(store_sales)).toHaveLength(0);
  });

  it("adds up the same variant on two lines before checking stock", async () => {
    const result = await sale([
      { variantId: BLACK_G, qty: 1, unitPrice: 200 },
      { variantId: BLACK_G, qty: 1, unitPrice: 150 },
    ]);
    expect(result.ok).toBe(false);
    expect(await stock(BLACK_G)).toBe(1);
  });

  it("refuses a discount above the pieces' value", async () => {
    const result = await sale([{ variantId: SHIRT, qty: 1, unitPrice: 80 }], { discount: 81 });
    expect(result).toEqual({ ok: false, message: "O desconto não pode ser maior que o valor das peças." });
    expect(await stock(SHIRT)).toBe(10);
  });

  describe("dinheiro", () => {
    it("keeps what was received and tells the change", async () => {
      const result = await sale([{ variantId: SHIRT, qty: 1, unitPrice: 80 }], {
        paymentMethod: "dinheiro",
        discount: 15,
        cashReceived: 100,
      });
      expect(result).toEqual({
        ok: true,
        message: `Venda #1 registrada: 1 peça baixada, ${formatCurrency(65)}. Troco: ${formatCurrency(35)}.`,
      });
      const [row] = await state.db.select().from(store_sales);
      expect(row).toMatchObject({ total: 65, cash_received: 100 });

      // The history reads it back.
      await state.db.update(store_sales).set({ created_at: "2026-10-26T15:00:00.000Z" });
      const period = resolvePeriod({ periodo: "dia", data: "2026-10-26" }, new Date("2026-10-26T18:00:00.000Z"));
      const { list } = await getStoreSalesDashboard(period);
      expect(list[0]).toMatchObject({ total: 65, cash_received: 100 });
    });

    it("says when there is no change", async () => {
      const result = await sale([{ variantId: SHIRT, qty: 1, unitPrice: 79.9 }], {
        paymentMethod: "dinheiro",
        cashReceived: 79.9,
      });
      expect(result.ok && result.message).toMatch(/ Sem troco\.$/);
    });

    it("refuses an amount below the total and changes nothing", async () => {
      const result = await sale([{ variantId: SHIRT, qty: 2, unitPrice: 80 }], {
        paymentMethod: "dinheiro",
        cashReceived: 150,
      });
      expect(result).toEqual({
        ok: false,
        message: `O valor recebido não cobre o total: faltam ${formatCurrency(10)}. Nada foi baixado.`,
      });
      expect(await stock(SHIRT)).toBe(10);
      expect(await state.db.select().from(store_sales)).toHaveLength(0);
    });

    it("is optional", async () => {
      const result = await sale([{ variantId: SHIRT, qty: 1, unitPrice: 80 }], { paymentMethod: "dinheiro" });
      expect(result).toEqual({ ok: true, message: `Venda #1 registrada: 1 peça baixada, ${formatCurrency(80)}.` });
      const [row] = await state.db.select().from(store_sales);
      expect(row.cash_received).toBeNull();
    });

    it("is never kept for another payment", async () => {
      const result = await sale([{ variantId: SHIRT, qty: 1, unitPrice: 80 }], { paymentMethod: "pix", cashReceived: 10 });
      expect(result.ok && result.message).not.toMatch(/troco/i);
      const [row] = await state.db.select().from(store_sales);
      expect(row.cash_received).toBeNull();
    });
  });

  it("keeps the customer's name on the sale", async () => {
    const created = await createStoreCustomerAction({ name: "Ana Souza", phone: "(11) 98888-7777", birthdate: "" });
    if (!created.ok) throw new Error(created.message);
    expect(created.customer.phone).toBe("11988887777");

    await sale([{ variantId: SHIRT, qty: 1, unitPrice: 80 }], { customerId: created.customer.id });
    const [row] = await state.db.select().from(store_sales);
    expect(row.customer_name).toBe("Ana Souza");

    // Deleting the customer keeps the history readable.
    await state.db.delete(store_customers);
    const [after] = await state.db.select().from(store_sales);
    expect(after).toMatchObject({ customer_id: null, customer_name: "Ana Souza" });
  });
});

describe("Desfazer baixa", () => {
  it("puts the pieces back once, however many times it is clicked", async () => {
    await sale([{ variantId: BLACK_M, qty: 2, unitPrice: 200 }]);
    const [row] = await state.db.select().from(store_sales);
    expect(await stock(BLACK_M)).toBe(3);

    const first = await cancelStoreSaleAction({ sale_id: row.id });
    expect(first).toEqual({ ok: true, message: "Baixa da venda #1 desfeita. 2 peças voltaram ao estoque." });
    expect(await stock(BLACK_M)).toBe(5);

    const second = await cancelStoreSaleAction({ sale_id: row.id });
    expect(second).toEqual({ ok: false, message: "Esta baixa já foi desfeita." });
    expect(await stock(BLACK_M)).toBe(5);
  });
});

async function onlySale() {
  const [row] = await state.db.select().from(store_sales);
  return row;
}

function edit(saleId: string, items: { variantId: string; qty: number; unitPrice: number }[], extra: Record<string, unknown> = {}) {
  return updateStoreSaleAction({ sale_id: saleId, items, paymentMethod: "pix", discount: 0, ...extra });
}

describe("Editar venda", () => {
  it("moves stock only by the difference and keeps the number and date", async () => {
    await sale([
      { variantId: BLACK_M, qty: 2, unitPrice: 200 },
      { variantId: SHIRT, qty: 1, unitPrice: 80 },
    ]);
    const before = await onlySale();

    const result = await edit(before.id, [
      { variantId: BLACK_M, qty: 1, unitPrice: 180 },
      { variantId: BLACK_G, qty: 1, unitPrice: 200 },
    ]);
    expect(result).toEqual({
      ok: true,
      message: `Venda #1 alterada: ${formatCurrency(380)}. 2 peças voltaram ao estoque, 1 peça saiu do estoque.`,
    });
    expect(await stock(BLACK_M)).toBe(4);
    expect(await stock(BLACK_G)).toBe(0);
    expect(await stock(SHIRT)).toBe(10);

    const after = await onlySale();
    expect(after).toMatchObject({ sale_number: 1, created_at: before.created_at, subtotal: 380, total: 380 });
    const items = await state.db.select().from(store_sale_items).where(eq(store_sale_items.sale_id, before.id));
    expect(items.map((item) => [item.variant_id, item.qty, item.unit_price]).sort()).toEqual(
      [
        [BLACK_G, 1, 200],
        [BLACK_M, 1, 180],
      ].sort(),
    );
  });

  it("counts the pieces the sale already holds as available", async () => {
    await sale([{ variantId: BLACK_G, qty: 1, unitPrice: 200 }]);
    const { id } = await onlySale();
    expect(await stock(BLACK_G)).toBe(0);

    const editable = await getEditableStoreSale(id);
    expect(editable?.lines).toMatchObject([{ variantId: BLACK_G, qty: 1, stock: 1 }]);

    const result = await edit(id, [{ variantId: BLACK_G, qty: 1, unitPrice: 150 }], {
      paymentMethod: "dinheiro",
      cashReceived: 200,
    });
    expect(result).toEqual({
      ok: true,
      message: `Venda #1 alterada: ${formatCurrency(150)}. O estoque não mudou. Troco: ${formatCurrency(50)}.`,
    });
    expect(await stock(BLACK_G)).toBe(0);
    expect(await onlySale()).toMatchObject({ payment_method: "dinheiro", cash_received: 200, total: 150 });
  });

  it("changes nothing when an added piece is short, and names it", async () => {
    await sale([{ variantId: BLACK_M, qty: 1, unitPrice: 200 }]);
    const { id } = await onlySale();

    const result = await edit(id, [
      { variantId: BLACK_M, qty: 3, unitPrice: 200 },
      { variantId: BLACK_G, qty: 2, unitPrice: 200 },
    ]);
    expect(result).toEqual({
      ok: false,
      message: "Sem estoque suficiente de Moletom King — Preto · G (resta 1). Nada foi alterado.",
    });
    expect(await stock(BLACK_M)).toBe(4);
    expect(await stock(BLACK_G)).toBe(1);
    expect(await onlySale()).toMatchObject({ total: 200 });
  });

  it("refuses a short cash amount", async () => {
    await sale([{ variantId: SHIRT, qty: 1, unitPrice: 80 }]);
    const { id } = await onlySale();
    const result = await edit(id, [{ variantId: SHIRT, qty: 2, unitPrice: 80 }], {
      paymentMethod: "dinheiro",
      cashReceived: 100,
    });
    expect(result).toEqual({
      ok: false,
      message: `O valor recebido não cobre o total: faltam ${formatCurrency(60)}. Nada foi alterado.`,
    });
    expect(await stock(SHIRT)).toBe(9);
  });

  it("refuses an undone sale", async () => {
    await sale([{ variantId: SHIRT, qty: 1, unitPrice: 80 }]);
    const { id } = await onlySale();
    await cancelStoreSaleAction({ sale_id: id });

    const result = await edit(id, [{ variantId: SHIRT, qty: 3, unitPrice: 80 }]);
    expect(result).toEqual({ ok: false, message: "Esta venda foi desfeita e não pode mais ser editada." });
    expect(await stock(SHIRT)).toBe(10);
  });

  it("keeps a line whose piece left the catalogue exactly as it was", async () => {
    await sale([
      { variantId: SHIRT, qty: 1, unitPrice: 70 },
      { variantId: BLACK_M, qty: 1, unitPrice: 200 },
    ]);
    const { id } = await onlySale();
    await state.db.update(product_variants).set({ archived_at: "2026-10-26T12:00:00.000Z" }).where(eq(product_variants.id, SHIRT));

    const editable = await getEditableStoreSale(id);
    expect(editable?.locked).toMatchObject([{ name: "Camiseta Básica", qty: 1, unitPrice: 70 }]);
    expect(editable?.lines.map((line) => line.variantId)).toEqual([BLACK_M]);

    // The form only sends the editable lines.
    const result = await edit(id, [{ variantId: BLACK_M, qty: 2, unitPrice: 200 }]);
    expect(result.ok).toBe(true);
    expect(await onlySale()).toMatchObject({ subtotal: 470, total: 470 });
    expect(await stock(SHIRT)).toBe(9);
    expect(await stock(BLACK_M)).toBe(3);
    const items = await state.db.select().from(store_sale_items).where(eq(store_sale_items.sale_id, id));
    expect(items).toHaveLength(2);

    // Nor can it come back as a new line.
    const again = await edit(id, [
      { variantId: BLACK_M, qty: 2, unitPrice: 200 },
      { variantId: SHIRT, qty: 1, unitPrice: 70 },
    ]);
    expect(again.ok).toBe(false);
  });

  it("keeps the name of a deleted customer unless it is taken off", async () => {
    const created = await createStoreCustomerAction({ name: "Ana Souza", phone: "", birthdate: "" });
    if (!created.ok) throw new Error(created.message);
    await sale([{ variantId: SHIRT, qty: 1, unitPrice: 80 }], { customerId: created.customer.id });
    const { id } = await onlySale();
    await state.db.delete(store_customers);

    const editable = await getEditableStoreSale(id);
    expect(editable).toMatchObject({ customer: null, formerCustomerName: "Ana Souza" });

    await edit(id, [{ variantId: SHIRT, qty: 1, unitPrice: 80 }], { keepCustomerName: true });
    expect((await onlySale()).customer_name).toBe("Ana Souza");
    await edit(id, [{ variantId: SHIRT, qty: 1, unitPrice: 80 }]);
    expect((await onlySale()).customer_name).toBeNull();
  });
});

describe("Excluir venda", () => {
  it("puts a standing sale's pieces back and removes it", async () => {
    await sale([
      { variantId: BLACK_M, qty: 2, unitPrice: 200 },
      { variantId: SHIRT, qty: 1, unitPrice: 80 },
    ]);
    const { id } = await onlySale();

    const result = await deleteStoreSaleAction({ sale_id: id });
    expect(result).toEqual({ ok: true, message: "Venda #1 excluída. 3 peças voltaram ao estoque." });
    expect(await stock(BLACK_M)).toBe(5);
    expect(await stock(SHIRT)).toBe(10);
    expect(await state.db.select().from(store_sales)).toHaveLength(0);
    expect(await state.db.select().from(store_sale_items)).toHaveLength(0);

    // A second click finds nothing and moves nothing.
    const second = await deleteStoreSaleAction({ sale_id: id });
    expect(second).toEqual({ ok: false, message: "Venda não encontrada. Ela pode ter sido excluída." });
    expect(await stock(BLACK_M)).toBe(5);
  });

  it("doesn't return an undone sale's pieces a second time", async () => {
    await sale([{ variantId: BLACK_M, qty: 2, unitPrice: 200 }]);
    const { id } = await onlySale();
    await cancelStoreSaleAction({ sale_id: id });
    expect(await stock(BLACK_M)).toBe(5);

    const result = await deleteStoreSaleAction({ sale_id: id });
    expect(result).toEqual({ ok: true, message: "Venda #1 excluída do histórico." });
    expect(await stock(BLACK_M)).toBe(5);
    expect(await state.db.select().from(store_sales)).toHaveLength(0);
  });
});

describe("dashboard", () => {
  it("counts by the store's clock and leaves undone sales out", async () => {
    // 23:30 in the store on 25/10 is already 26/10 in UTC.
    const late = await sale([{ variantId: BLACK_M, qty: 1, unitPrice: 200 }]);
    expect(late.ok).toBe(true);
    await state.db.update(store_sales).set({ created_at: "2026-10-26T02:30:00.000Z" });

    await sale([{ variantId: SHIRT, qty: 3, unitPrice: 80 }]);
    await sale([{ variantId: BLACK_M, qty: 1, unitPrice: 200 }]);
    const rows = await state.db.select().from(store_sales);
    const shirts = rows.find((r) => r.sale_number === 2)!;
    const undone = rows.find((r) => r.sale_number === 3)!;
    await state.db.update(store_sales).set({ created_at: "2026-10-26T15:00:00.000Z" }).where(eq(store_sales.id, shirts.id));
    await state.db.update(store_sales).set({ created_at: "2026-10-26T16:00:00.000Z" }).where(eq(store_sales.id, undone.id));
    await cancelStoreSaleAction({ sale_id: undone.id });

    const now = new Date("2026-10-26T18:00:00.000Z");
    const day = await getStoreSalesDashboard(resolvePeriod({ periodo: "dia", data: "2026-10-26" }, now));
    expect(day).toMatchObject({ revenue: 240, sales: 1, pieces: 3 });
    expect(day.series.find((b) => b.key === "12")?.total).toBe(240);
    // The undone sale is still in the list, marked.
    expect(day.list.map((s) => [s.sale_number, Boolean(s.canceled_at)])).toEqual([[3, true], [2, false]]);

    const previous = await getStoreSalesDashboard(resolvePeriod({ periodo: "dia", data: "2026-10-25" }, now));
    expect(previous).toMatchObject({ revenue: 200, sales: 1 });
    expect(previous.series.find((b) => b.key === "23")?.total).toBe(200);

    const month = await getStoreSalesDashboard(resolvePeriod({ periodo: "mes", data: "2026-10" }, now));
    expect(month).toMatchObject({ revenue: 440, sales: 2, pieces: 4, averageTicket: 220 });
    expect(month.topProducts.map((p) => [p.name, p.qty])).toEqual([
      ["Camiseta Básica", 3],
      ["Moletom King", 1],
    ]);
    expect(month.topProducts[0].variants).toEqual([{ color: "Branco", size: "P", qty: 3 }]);
    expect(month.byPayment).toEqual([{ method: "pix", sales: 2, total: 440 }]);
  });

  it("spreads a sale's discount over its pieces in the ranking", async () => {
    await sale(
      [
        { variantId: BLACK_M, qty: 1, unitPrice: 200 },
        { variantId: SHIRT, qty: 1, unitPrice: 100 },
      ],
      { discount: 30 },
    );
    const period = resolvePeriod({ periodo: "ano" });
    const year = await getStoreSalesDashboard(period);
    expect(year.revenue).toBe(270);
    expect(year.topProducts.find((p) => p.name === "Moletom King")?.revenue).toBeCloseTo(180);
    expect(year.topProducts.find((p) => p.name === "Camiseta Básica")?.revenue).toBeCloseTo(90);
  });
});

describe("busca e aniversários", () => {
  it("finds products by name without accents, and by SKU — drafts included", async () => {
    expect((await searchStoreProducts("camiseta basica")).map((p) => p.name)).toEqual(["Camiseta Básica"]);
    expect((await searchStoreProducts("MOL-PT-M")).map((p) => p.name)).toEqual(["Moletom King"]);
  });

  it("lists the next 30 days of birthdays and remembers who got the message", async () => {
    const now = new Date("2026-10-26T15:00:00.000Z");
    const today = await createStoreCustomerAction({ name: "Bruno Lima", phone: "11977776666", birthdate: "1990-10-26" });
    await createStoreCustomerAction({ name: "Carla Dias", birthdate: "2000-11-10" });
    await createStoreCustomerAction({ name: "Diego Reis", birthdate: "1985-03-01" });
    await createStoreCustomerAction({ name: "Sem Data" });
    if (!today.ok) throw new Error(today.message);

    const list = await getUpcomingBirthdays(now);
    expect(list.map((b) => [b.name, b.daysUntil, b.turning])).toEqual([
      ["Bruno Lima", 0, 36],
      ["Carla Dias", 15, 26],
    ]);
    expect(list[0].sentThisYear).toBe(false);

    vi.useFakeTimers({ now, toFake: ["Date"] });
    try {
      await markBirthdaySentAction({ customer_id: today.customer.id });
    } finally {
      vi.useRealTimers();
    }
    expect((await getUpcomingBirthdays(now))[0].sentThisYear).toBe(true);
  });

  it("refuses a second customer with the same phone", async () => {
    await createStoreCustomerAction({ name: "Ana", phone: "11988887777" });
    const again = await createStoreCustomerAction({ name: "Ana Clara", phone: "(11) 98888-7777" });
    expect(again).toEqual({ ok: false, message: "Já existe um cliente cadastrado com esse telefone." });
  });
});
