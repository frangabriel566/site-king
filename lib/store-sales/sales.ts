import "server-only";
import { and, eq, inArray, isNotNull, isNull, notInArray, sql } from "drizzle-orm";
import { getDb, schema, type Db } from "@/lib/db";
import { insertChunks, runBatch } from "@/lib/db/batch";
import { describeDbError, isCheckViolation } from "@/lib/db/errors";
import { nextStoreSaleNumber } from "@/lib/db/sequences";
import { roundMoney } from "@/lib/money";
import { formatCurrency, formatVariantLabel } from "@/lib/format";
import type { StorePaymentMethod } from "@/lib/store-sales/payment-methods";
import type { StoreSaleInput, StoreSaleUpdateInput } from "@/lib/validations/store-sale";

/**
 * Vendas na loja física: "Dar baixa", editing a sale, "Desfazer baixa" and
 * deleting it.
 *
 * Same stock rules as confirming a WhatsApp sale (lib/orders/whatsapp.ts):
 * everything happens in one D1 batch, and the CHECK (stock >= 0) on
 * product_variants makes a decrement that would go negative fail the whole
 * batch — either every piece leaves stock with the sale recorded, or
 * nothing changes. Callers do the permission check (requireAdmin).
 */

const { store_sales, store_sale_items, store_customers, product_variants } = schema;

export type StoreSaleErrorCode =
  | "VARIANT_NOT_FOUND"
  /** detail: the piece, e.g. "Moletom — Preto · M (restam 2)". */
  | "OUT_OF_STOCK"
  | "DISCOUNT_TOO_HIGH"
  /** detail: what is missing, e.g. "R$ 5,00". */
  | "CASH_TOO_LOW"
  | "CUSTOMER_NOT_FOUND"
  | "EMPTY_SALE"
  | "NOT_FOUND"
  | "ALREADY_CANCELED"
  /** Undone or brought back in another tab while it was being edited. */
  | "SALE_CHANGED";

export class StoreSaleError extends Error {
  constructor(
    readonly code: StoreSaleErrorCode,
    readonly detail?: string,
  ) {
    super(detail ? `${code}:${detail}` : code);
  }
}

async function loadVariants(db: Db, ids: string[]) {
  const variants =
    ids.length === 0
      ? []
      : await db.query.product_variants.findMany({
          columns: { id: true, color: true, size: true, stock: true, archived_at: true },
          where: inArray(product_variants.id, ids),
          with: { product: { columns: { id: true, name: true, deleted_at: true } } },
        });
  return new Map(variants.map((variant) => [variant.id, variant]));
}

type LoadedVariant = Awaited<ReturnType<typeof loadVariants>> extends Map<string, infer V> ? V : never;

/** Still in the catalogue: a sale can take it. */
function isSellable(variant: LoadedVariant | undefined): variant is LoadedVariant {
  return Boolean(variant && !variant.archived_at && !variant.product.deleted_at);
}

/** Names the piece that is short. `available` is what this sale can take. */
function outOfStock(variant: LoadedVariant, available: number): StoreSaleError {
  const label = formatVariantLabel(variant.color, variant.size);
  return new StoreSaleError(
    "OUT_OF_STOCK",
    `${variant.product.name}${label ? ` — ${label}` : ""} (${
      available === 0 ? "acabou" : available === 1 ? "resta 1" : `restam ${available}`
    })`,
  );
}

/** The same variant on two lines (two prices, say) still has one stock. */
function qtyByVariant(items: { variantId: string; qty: number }[]): Map<string, number> {
  const qty = new Map<string, number>();
  for (const item of items) qty.set(item.variantId, (qty.get(item.variantId) ?? 0) + item.qty);
  return qty;
}

async function customerName(db: Db, customerId: string): Promise<string> {
  const customer = await db.query.store_customers.findFirst({
    columns: { name: true },
    where: eq(store_customers.id, customerId),
  });
  if (!customer) throw new StoreSaleError("CUSTOMER_NOT_FOUND");
  return customer.name;
}

function saleAmounts(
  lines: { qty: number; unitPrice: number }[],
  input: { discount: number; paymentMethod: StorePaymentMethod; cashReceived: number | null },
) {
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0));
  const discount = roundMoney(input.discount);
  if (discount > subtotal) throw new StoreSaleError("DISCOUNT_TOO_HIGH");
  const total = roundMoney(subtotal - discount);
  // Only cash has change. The form blocks a short amount; this is the check
  // that counts, against the total worked out here.
  const cashReceived =
    input.paymentMethod === "dinheiro" && input.cashReceived !== null ? roundMoney(input.cashReceived) : null;
  if (cashReceived !== null && cashReceived < total) {
    throw new StoreSaleError("CASH_TOO_LOW", formatCurrency(roundMoney(total - cashReceived)));
  }
  return { subtotal, discount, total, cashReceived };
}

function itemRows(saleId: string, items: StoreSaleInput["items"], byId: Map<string, LoadedVariant>) {
  return items.map((item) => {
    const variant = byId.get(item.variantId)!;
    return {
      sale_id: saleId,
      product_id: variant.product.id,
      variant_id: variant.id,
      name: variant.product.name,
      color: variant.color,
      size: variant.size,
      unit_price: roundMoney(item.unitPrice),
      qty: item.qty,
    };
  });
}

export type CreatedStoreSale = {
  id: string;
  saleNumber: number;
  total: number;
  pieces: number;
  /** Dinheiro with the amount received typed in; null otherwise. */
  change: number | null;
};

export async function createStoreSale(
  input: StoreSaleInput,
  createdBy: string | null,
  now = new Date().toISOString(),
): Promise<CreatedStoreSale> {
  const db = getDb();
  const wanted = qtyByVariant(input.items);
  const byId = await loadVariants(db, [...wanted.keys()]);

  for (const [variantId, qty] of wanted) {
    const variant = byId.get(variantId);
    if (!isSellable(variant)) throw new StoreSaleError("VARIANT_NOT_FOUND");
    // Name the piece that is short before touching anything.
    if (variant.stock < qty) throw outOfStock(variant, variant.stock);
  }

  const name = input.customerId ? await customerName(db, input.customerId) : null;
  const { subtotal, discount, total, cashReceived } = saleAmounts(input.items, input);
  const saleId = crypto.randomUUID();

  let results;
  try {
    results = await runBatch(db, [
      db
        .insert(store_sales)
        .values({
          id: saleId,
          sale_number: nextStoreSaleNumber,
          customer_id: input.customerId,
          customer_name: name,
          payment_method: input.paymentMethod,
          subtotal,
          discount,
          total,
          cash_received: cashReceived,
          note: input.note,
          created_by: createdBy,
          created_at: now,
        })
        .returning({ sale_number: store_sales.sale_number }),
      ...insertChunks(db, store_sale_items, itemRows(saleId, input.items, byId)),
      // No `stock >= qty` filter on purpose: the CHECK fails the batch.
      ...[...wanted].map(([variantId, qty]) =>
        db
          .update(product_variants)
          .set({ stock: sql`${product_variants.stock} - ${qty}` })
          .where(eq(product_variants.id, variantId)),
      ),
    ]);
  } catch (error) {
    // Stock changed between the check above and the batch.
    if (isCheckViolation(error, "product_variants_stock_check")) {
      throw new StoreSaleError("OUT_OF_STOCK", "uma das peças");
    }
    throw error;
  }

  const [created] = results[0] as { sale_number: number }[];
  return {
    id: saleId,
    saleNumber: created.sale_number,
    total,
    pieces: input.items.reduce((sum, item) => sum + item.qty, 0),
    change: cashReceived === null ? null : roundMoney(cashReceived - total),
  };
}

export type UpdatedStoreSale = CreatedStoreSale & {
  /** Pieces the edit put back in stock. */
  returned: number;
  /** Pieces the edit took out of stock. */
  taken: number;
  /** It had been undone: saving brought it back into the totals. */
  reactivated: boolean;
};

/**
 * Edits a sale in place: same number, same date. Stock moves only by the
 * difference — a piece taken off the sale goes back, a piece added leaves —
 * and a line whose piece left the catalogue since stays exactly as it was
 * (nothing to give it back to; the form shows it locked).
 *
 * An undone sale can be edited too, and saving brings it back: its pieces
 * went back to stock when it was undone, so they all leave again.
 */
export async function updateStoreSale(saleId: string, input: StoreSaleUpdateInput): Promise<UpdatedStoreSale> {
  const db = getDb();
  const sale = await db.query.store_sales.findFirst({
    columns: { sale_number: true, canceled_at: true, customer_id: true, customer_name: true },
    where: eq(store_sales.id, saleId),
    with: { items: { columns: { id: true, variant_id: true, qty: true, unit_price: true } } },
  });
  if (!sale) throw new StoreSaleError("NOT_FOUND");
  const reactivating = sale.canceled_at !== null;

  const wanted = qtyByVariant(input.items);
  const byId = await loadVariants(db, [
    ...new Set([...wanted.keys(), ...sale.items.flatMap((item) => (item.variant_id ? [item.variant_id] : []))]),
  ]);

  const locked = sale.items.filter((item) => !item.variant_id || !isSellable(byId.get(item.variant_id)));
  // An undone sale holds nothing: the undo gave its pieces back.
  const held = reactivating
    ? new Map<string, number>()
    : qtyByVariant(
        sale.items.flatMap((item) => (locked.includes(item) ? [] : [{ variantId: item.variant_id!, qty: item.qty }])),
      );
  if (wanted.size + locked.length === 0) throw new StoreSaleError("EMPTY_SALE");

  // What leaves stock (> 0) or comes back (< 0) for each piece.
  const delta = new Map<string, number>();
  for (const variantId of new Set([...wanted.keys(), ...held.keys()])) {
    const change = (wanted.get(variantId) ?? 0) - (held.get(variantId) ?? 0);
    if (change !== 0) delta.set(variantId, change);
  }
  for (const variantId of wanted.keys()) {
    const variant = byId.get(variantId);
    if (!isSellable(variant)) throw new StoreSaleError("VARIANT_NOT_FOUND");
    // The pieces this sale already holds count as available to it.
    const change = delta.get(variantId) ?? 0;
    if (change > variant.stock) throw outOfStock(variant, variant.stock + (held.get(variantId) ?? 0));
  }

  // A customer deleted from the book leaves the sale with only the name;
  // the form keeps it unless it is taken off or another customer picked.
  const name = input.customerId
    ? await customerName(db, input.customerId)
    : input.keepCustomerName && !sale.customer_id
      ? sale.customer_name
      : null;
  const { subtotal, discount, total, cashReceived } = saleAmounts(
    [...input.items, ...locked.map((item) => ({ qty: item.qty, unitPrice: item.unit_price }))],
    input,
  );
  const lockedIds = locked.map((item) => item.id);
  // Deleted in another tab after the read above: no piece moves.
  const saleExists = sql`exists (select 1 from ${store_sales} where ${store_sales.id} = ${saleId})`;

  let results;
  try {
    results = await runBatch(db, [
      // Undone (or, for an undone sale, brought back) in another tab after
      // the read above: this trips the amounts CHECK (discount >= 0) and
      // rolls the whole batch back, so no stock moves twice.
      db
        .update(store_sales)
        .set({ discount: -1 })
        .where(
          and(
            eq(store_sales.id, saleId),
            reactivating ? isNull(store_sales.canceled_at) : isNotNull(store_sales.canceled_at),
          ),
        ),
      ...[...delta].map(([variantId, change]) =>
        db
          .update(product_variants)
          .set({ stock: sql`${product_variants.stock} - ${change}` })
          .where(and(eq(product_variants.id, variantId), saleExists)),
      ),
      db
        .delete(store_sale_items)
        .where(
          and(
            eq(store_sale_items.sale_id, saleId),
            ...(lockedIds.length > 0 ? [notInArray(store_sale_items.id, lockedIds)] : []),
          ),
        ),
      ...insertChunks(db, store_sale_items, itemRows(saleId, input.items, byId)),
      db
        .update(store_sales)
        .set({
          customer_id: input.customerId,
          customer_name: name,
          payment_method: input.paymentMethod,
          subtotal,
          discount,
          total,
          cash_received: cashReceived,
          note: input.note,
          canceled_at: null,
        })
        .where(eq(store_sales.id, saleId))
        .returning({ id: store_sales.id }),
    ]);
  } catch (error) {
    if (isCheckViolation(error, "product_variants_stock_check")) {
      throw new StoreSaleError("OUT_OF_STOCK", "uma das peças");
    }
    if (isCheckViolation(error, "store_sales_amounts_check")) throw new StoreSaleError("SALE_CHANGED");
    // New lines of a sale deleted in between fail its foreign key.
    if (describeDbError(error).includes("FOREIGN KEY constraint failed")) throw new StoreSaleError("NOT_FOUND");
    throw error;
  }
  if ((results[results.length - 1] as { id: string }[]).length === 0) throw new StoreSaleError("NOT_FOUND");

  const moved = [...delta.values()];
  return {
    id: saleId,
    saleNumber: sale.sale_number,
    total,
    pieces: [...input.items, ...locked].reduce((sum, item) => sum + item.qty, 0),
    change: cashReceived === null ? null : roundMoney(cashReceived - total),
    returned: moved.filter((change) => change < 0).reduce((sum, change) => sum - change, 0),
    taken: moved.filter((change) => change > 0).reduce((sum, change) => sum + change, 0),
    reactivated: reactivating,
  };
}

/** Which of a sale's pieces can go back to stock: their variant is still
 * there. The rest left the catalogue since — nowhere to go back to. */
async function restorable(db: Db, items: { variant_id: string | null; qty: number }[]) {
  const variantIds = items.flatMap((item) => (item.variant_id ? [item.variant_id] : []));
  const live =
    variantIds.length === 0
      ? []
      : await db
          .select({ id: product_variants.id })
          .from(product_variants)
          .where(and(inArray(product_variants.id, variantIds), isNull(product_variants.archived_at)));
  const liveIds = new Set(live.map((variant) => variant.id));

  const qty = new Map<string, number>();
  let notRestored = 0;
  for (const item of items) {
    if (item.variant_id && liveIds.has(item.variant_id)) {
      qty.set(item.variant_id, (qty.get(item.variant_id) ?? 0) + item.qty);
    } else {
      notRestored += item.qty;
    }
  }
  return { qty, notRestored };
}

/** Puts a sale's pieces back — only while the sale exists and wasn't
 * undone, so two clicks (or an undo and a delete) never return them twice. */
function returnToStock(db: Db, saleId: string, qty: Map<string, number>) {
  const stillActive = sql`exists (select 1 from ${store_sales} where ${store_sales.id} = ${saleId} and ${store_sales.canceled_at} is null)`;
  return [...qty].map(([variantId, pieces]) =>
    db
      .update(product_variants)
      .set({ stock: sql`${product_variants.stock} + ${pieces}` })
      .where(and(eq(product_variants.id, variantId), stillActive)),
  );
}

export type CanceledStoreSale = {
  saleNumber: number;
  /** Pieces back in stock. */
  restored: number;
  /** Pieces whose variant left the catalogue since the sale — nowhere to go
   * back to. */
  notRestored: number;
};

/**
 * "Desfazer baixa": the pieces go back to stock and the sale stays in the
 * history, marked, out of every total. Idempotent — the guard on
 * `canceled_at` makes a second click change nothing.
 */
export async function cancelStoreSale(
  saleId: string,
  now = new Date().toISOString(),
): Promise<CanceledStoreSale> {
  const db = getDb();
  const sale = await db.query.store_sales.findFirst({
    columns: { sale_number: true, canceled_at: true },
    where: eq(store_sales.id, saleId),
    with: { items: { columns: { variant_id: true, qty: true } } },
  });
  if (!sale) throw new StoreSaleError("NOT_FOUND");
  if (sale.canceled_at) throw new StoreSaleError("ALREADY_CANCELED");

  const { qty, notRestored } = await restorable(db, sale.items);
  const results = await runBatch(db, [
    ...returnToStock(db, saleId, qty),
    db
      .update(store_sales)
      .set({ canceled_at: now })
      .where(and(eq(store_sales.id, saleId), isNull(store_sales.canceled_at)))
      .returning({ id: store_sales.id }),
  ]);

  // Undone by another click in between: the guard made every statement a
  // no-op.
  const canceled = results[results.length - 1] as { id: string }[];
  if (canceled.length === 0) throw new StoreSaleError("ALREADY_CANCELED");

  return {
    saleNumber: sale.sale_number,
    restored: [...qty.values()].reduce((sum, pieces) => sum + pieces, 0),
    notRestored,
  };
}

export type DeletedStoreSale = CanceledStoreSale & {
  /** It had been undone already: its pieces were back in stock before. */
  wasCanceled: boolean;
};

/**
 * "Excluir": the sale leaves the history and every total for good. A sale
 * still standing gives its pieces back first, like "Desfazer baixa"; an
 * undone one had them back already.
 */
export async function deleteStoreSale(saleId: string): Promise<DeletedStoreSale> {
  const db = getDb();
  const sale = await db.query.store_sales.findFirst({
    columns: { sale_number: true, canceled_at: true },
    where: eq(store_sales.id, saleId),
    with: { items: { columns: { variant_id: true, qty: true } } },
  });
  if (!sale) throw new StoreSaleError("NOT_FOUND");

  const { qty, notRestored } = sale.canceled_at
    ? { qty: new Map<string, number>(), notRestored: 0 }
    : await restorable(db, sale.items);
  const results = await runBatch(db, [
    ...returnToStock(db, saleId, qty),
    db.delete(store_sale_items).where(eq(store_sale_items.sale_id, saleId)),
    db.delete(store_sales).where(eq(store_sales.id, saleId)).returning({ canceled_at: store_sales.canceled_at }),
  ]);

  // Deleted by another click in between: nothing was left to delete.
  const [deleted] = results[results.length - 1] as { canceled_at: string | null }[];
  if (!deleted) throw new StoreSaleError("NOT_FOUND");
  // Undone in between: the guard kept its pieces from coming back twice.
  const wasCanceled = deleted.canceled_at !== null;

  return {
    saleNumber: sale.sale_number,
    restored: wasCanceled ? 0 : [...qty.values()].reduce((sum, pieces) => sum + pieces, 0),
    notRestored: wasCanceled ? 0 : notRestored,
    wasCanceled,
  };
}
