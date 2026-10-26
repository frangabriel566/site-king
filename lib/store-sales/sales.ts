import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { insertChunks, runBatch } from "@/lib/db/batch";
import { isCheckViolation } from "@/lib/db/errors";
import { nextStoreSaleNumber } from "@/lib/db/sequences";
import { roundMoney } from "@/lib/money";
import { formatVariantLabel } from "@/lib/format";
import type { StoreSaleInput } from "@/lib/validations/store-sale";

/**
 * Vendas na loja física: "Dar baixa" and "Desfazer baixa".
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
  | "CUSTOMER_NOT_FOUND"
  | "NOT_FOUND"
  | "ALREADY_CANCELED";

export class StoreSaleError extends Error {
  constructor(
    readonly code: StoreSaleErrorCode,
    readonly detail?: string,
  ) {
    super(detail ? `${code}:${detail}` : code);
  }
}

export type CreatedStoreSale = { id: string; saleNumber: number; total: number; pieces: number };

export async function createStoreSale(
  input: StoreSaleInput,
  createdBy: string | null,
  now = new Date().toISOString(),
): Promise<CreatedStoreSale> {
  const db = getDb();

  // The same variant on two lines (two prices, say) still has one stock.
  const qtyByVariant = new Map<string, number>();
  for (const item of input.items) {
    qtyByVariant.set(item.variantId, (qtyByVariant.get(item.variantId) ?? 0) + item.qty);
  }

  const variants = await db.query.product_variants.findMany({
    columns: { id: true, color: true, size: true, stock: true, archived_at: true },
    where: inArray(product_variants.id, [...qtyByVariant.keys()]),
    with: { product: { columns: { id: true, name: true, deleted_at: true } } },
  });
  const byId = new Map(variants.map((variant) => [variant.id, variant]));

  for (const [variantId, qty] of qtyByVariant) {
    const variant = byId.get(variantId);
    if (!variant || variant.archived_at || variant.product.deleted_at) {
      throw new StoreSaleError("VARIANT_NOT_FOUND");
    }
    // Name the piece that is short before touching anything.
    if (variant.stock < qty) {
      const label = formatVariantLabel(variant.color, variant.size);
      throw new StoreSaleError(
        "OUT_OF_STOCK",
        `${variant.product.name}${label ? ` — ${label}` : ""} (${
          variant.stock === 1 ? "resta 1" : `restam ${variant.stock}`
        })`,
      );
    }
  }

  let customerName: string | null = null;
  if (input.customerId) {
    const customer = await db.query.store_customers.findFirst({
      columns: { name: true },
      where: eq(store_customers.id, input.customerId),
    });
    if (!customer) throw new StoreSaleError("CUSTOMER_NOT_FOUND");
    customerName = customer.name;
  }

  const subtotal = roundMoney(input.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0));
  const discount = roundMoney(input.discount);
  if (discount > subtotal) throw new StoreSaleError("DISCOUNT_TOO_HIGH");
  const total = roundMoney(subtotal - discount);
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
          customer_name: customerName,
          payment_method: input.paymentMethod,
          subtotal,
          discount,
          total,
          note: input.note,
          created_by: createdBy,
          created_at: now,
        })
        .returning({ sale_number: store_sales.sale_number }),
      ...insertChunks(
        db,
        store_sale_items,
        input.items.map((item) => {
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
        }),
      ),
      // No `stock >= qty` filter on purpose: the CHECK fails the batch.
      ...[...qtyByVariant].map(([variantId, qty]) =>
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
  };
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

  const variantIds = sale.items.flatMap((item) => (item.variant_id ? [item.variant_id] : []));
  const live =
    variantIds.length === 0
      ? []
      : await db
          .select({ id: product_variants.id })
          .from(product_variants)
          .where(and(inArray(product_variants.id, variantIds), isNull(product_variants.archived_at)));
  const liveIds = new Set(live.map((variant) => variant.id));

  const qtyByVariant = new Map<string, number>();
  let notRestored = 0;
  for (const item of sale.items) {
    if (item.variant_id && liveIds.has(item.variant_id)) {
      qtyByVariant.set(item.variant_id, (qtyByVariant.get(item.variant_id) ?? 0) + item.qty);
    } else {
      notRestored += item.qty;
    }
  }

  const stillActive = sql`exists (select 1 from ${store_sales} where ${store_sales.id} = ${saleId} and ${store_sales.canceled_at} is null)`;

  const results = await runBatch(db, [
    ...[...qtyByVariant].map(([variantId, qty]) =>
      db
        .update(product_variants)
        .set({ stock: sql`${product_variants.stock} + ${qty}` })
        .where(and(eq(product_variants.id, variantId), stillActive)),
    ),
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
    restored: [...qtyByVariant.values()].reduce((sum, qty) => sum + qty, 0),
    notRestored,
  };
}
