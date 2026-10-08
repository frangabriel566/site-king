import "server-only";
import { and, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { insertChunks, runBatch } from "@/lib/db/batch";
import { isCheckViolation } from "@/lib/db/errors";
import { WHATSAPP_CODE_COUNTER, currentWhatsAppCode, nextOrderNumber } from "@/lib/db/sequences";
import { roundMoney } from "@/lib/money";
import type { CustomerSnapshot } from "@/lib/db/schema";
import { isCouponLimitError, takeCouponUse } from "@/lib/coupons/usage";
import { priceOrder } from "@/lib/orders/pricing";
import type { ShippingMode } from "@/lib/shipping-mode";

/**
 * Compra direta pelo WhatsApp — the four Postgres functions of migration
 * 0014 (create/confirm/cancel/expire), as server code over D1 batches.
 * Callers do the permission checks: creating is open to anyone (a guest
 * can buy), confirming and cancelling are admin-only (lib/auth/guards.ts).
 */

const { orders, order_items, product_variants, customers, user, counters, coupons } = schema;

const PENDING = "aguardando_whatsapp";
const EXPIRY_MS = 48 * 60 * 60 * 1000;

export type WhatsAppOrderErrorCode =
  | "EMPTY_CART"
  | "TOO_MANY_ITEMS"
  | "NO_AVAILABLE_ITEMS"
  | "NOT_FOUND"
  | "NOT_PENDING"
  | "EXPIRED"
  | "OUT_OF_STOCK"
  /** detail: why, in Portuguese (lib/coupons/rules.ts). */
  | "COUPON";

export class WhatsAppOrderError extends Error {
  constructor(
    readonly code: WhatsAppOrderErrorCode,
    /** For OUT_OF_STOCK: the name of the piece that ran out. For COUPON:
     * the reason, ready for the shopper. */
    readonly detail?: string,
  ) {
    super(detail ? `${code}:${detail}` : code);
  }
}

/**
 * A varredura das 48h. Não há cron neste projeto, então a expiração é
 * oportunista: roda ao abrir a aba do painel e a cada pedido novo criado.
 * A rede de segurança de verdade está em confirmWhatsAppOrder(), que
 * recusa um pedido vencido mesmo que esta varredura ainda não tenha
 * passado por ele.
 */
export async function expireWhatsAppOrders(): Promise<number> {
  const db = getDb();
  const due = and(
    eq(orders.status, PENDING),
    isNotNull(orders.expires_at),
    lte(orders.expires_at, new Date().toISOString()),
  );
  // The coupon uses these orders held go back, in the same transaction as
  // the expiry itself (lib/coupons/usage.ts) — first, while the orders
  // still read as pending.
  const [, expired] = await runBatch(db, [
    db
      .update(coupons)
      .set({
        used_count: sql`max(${coupons.used_count} - (select count(*) from ${orders} where ${orders.coupon_code} = ${coupons.code} and ${due}), 0)`,
      })
      .where(sql`${coupons.code} in (select ${orders.coupon_code} from ${orders} where ${due})`),
    db.update(orders).set({ status: "expirado" }).where(due).returning({ id: orders.id }),
  ]);
  return (expired as { id: string }[]).length;
}

export type CreatedWhatsAppOrder = {
  order_id: string;
  code: string;
  expires_at: string;
  total: number;
  items: {
    name: string;
    slug: string;
    color: string | null;
    size: string | null;
    qty: number;
    unit_price: number;
  }[];
  /** Before the coupon. */
  subtotal: number;
  discount: number;
  coupon_code: string | null;
  /** Free (the store's rule or the coupon) or agreed in the conversation. */
  shipping_mode: ShippingMode;
  adjusted: boolean;
};

/**
 * O pedido inteiro numa transação. Recebe só `[{variantId, qty}]`: nome,
 * cor, tamanho e **preço** são lidos do banco aqui dentro — a sacola vive
 * em localStorage e nunca é fonte de verdade para dinheiro.
 *
 * Não reserva estoque: apara o pedido ao que existe hoje, para a loja não
 * mandar ao cliente uma mensagem prometendo o que não tem. A checagem que
 * vale acontece de novo na confirmação.
 */
export async function createWhatsAppOrder(
  requested: { variantId: string; qty: number }[],
  userId: string | null,
  couponCode: string | null = null,
): Promise<CreatedWhatsAppOrder> {
  if (requested.length === 0) throw new WhatsAppOrderError("EMPTY_CART");
  // Teto grosseiro: uma sacola real não passa disso, e sem ele um POST
  // forjado com dez mil linhas viraria dez mil inserts.
  if (requested.length > 50) throw new WhatsAppOrderError("TOO_MANY_ITEMS");

  await expireWhatsAppOrders();

  const db = getDb();
  const variants = await db.query.product_variants.findMany({
    columns: { id: true, color: true, size: true, stock: true, archived_at: true },
    where: inArray(
      product_variants.id,
      requested.map((r) => r.variantId),
    ),
    with: { product: { columns: { id: true, name: true, price: true, slug: true, status: true } } },
  });

  let adjusted = false;
  const lines: (CreatedWhatsAppOrder["items"][number] & {
    product_id: string;
    variant_id: string;
  })[] = [];

  for (const raw of requested) {
    let qty = Number.isFinite(raw.qty) ? Math.trunc(raw.qty) : 0;
    if (qty <= 0) {
      adjusted = true;
      continue;
    }
    if (qty > 99) {
      qty = 99;
      adjusted = true;
    }

    const variant = variants.find((v) => v.id === raw.variantId);
    // Variação sumiu, ou o produto saiu do ar entre o "adicionar à
    // sacola" e agora, ou a variação foi retirada do produto (arquivada):
    // a linha cai fora e a resposta avisa.
    if (!variant || variant.product.status !== "active" || variant.archived_at) {
      adjusted = true;
      continue;
    }
    if (variant.stock < qty) {
      qty = Math.max(variant.stock, 0);
      adjusted = true;
    }
    if (qty <= 0) continue;

    lines.push({
      product_id: variant.product.id,
      variant_id: variant.id,
      name: variant.product.name,
      slug: variant.product.slug,
      color: variant.color,
      size: variant.size,
      qty,
      unit_price: variant.product.price,
    });
  }

  // Nada sobrou de pé: nenhum pedido vazio com código queimado.
  if (lines.length === 0) throw new WhatsAppOrderError("NO_AVAILABLE_ITEMS");

  // Só quem tem cadastro de cliente completo fica amarrado ao pedido;
  // os outros seguem como visitante, identificados na própria conversa.
  let customerId: string | null = null;
  let snapshot: CustomerSnapshot | null = null;
  if (userId) {
    const [row] = await db
      .select({ name: customers.name, phone: customers.phone, email: user.email })
      .from(customers)
      .innerJoin(user, eq(user.id, customers.id))
      .where(eq(customers.id, userId));
    if (row) {
      customerId = userId;
      snapshot = { name: row.name, email: row.email, phone: row.phone };
    }
  }

  // Sem valor de frete de propósito: este caminho não pede endereço, e o
  // frete é combinado na conversa — ou é grátis, pela regra da loja ou
  // pelo cupom. O cupom aplicado na sacola é conferido de novo contra o
  // subtotal do banco: o que a sacola mostrou foi só a prévia.
  const subtotal = roundMoney(lines.reduce((sum, l) => sum + l.unit_price * l.qty, 0));
  const priced = await priceOrder(subtotal, couponCode);
  if (!priced.ok) throw new WhatsAppOrderError("COUPON", priced.message);
  const { discount, couponCode: appliedCoupon, shippingMode, total } = priced.pricing;
  const orderId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + EXPIRY_MS).toISOString();

  let results;
  try {
    results = await runBatch(db, [
    db
      .insert(counters)
      .values({ name: WHATSAPP_CODE_COUNTER, value: 1 })
      .onConflictDoUpdate({ target: counters.name, set: { value: sql`${counters.value} + 1` } }),
    db
      .insert(orders)
      .values({
        id: orderId,
        order_number: nextOrderNumber,
        customer_id: customerId,
        status: PENDING,
        code: currentWhatsAppCode,
        expires_at: expiresAt,
        subtotal,
        shipping: 0,
        shipping_mode: shippingMode,
        discount,
        total,
        coupon_code: appliedCoupon,
        payment_method: "whatsapp",
        customer_snapshot: snapshot,
      })
      .returning({ code: orders.code }),
    ...insertChunks(
      db,
      order_items,
      lines.map((line) => ({
        order_id: orderId,
        product_id: line.product_id,
        variant_id: line.variant_id,
        name: line.name,
        color: line.color,
        size: line.size,
        unit_price: line.unit_price,
        qty: line.qty,
      })),
    ),
    // Same batch: past the coupon's limit, no order and no code burned.
    ...(appliedCoupon ? [takeCouponUse(db, appliedCoupon)] : []),
  ]);
  } catch (error) {
    if (isCouponLimitError(error)) {
      throw new WhatsAppOrderError("COUPON", "Este cupom acabou de atingir o limite de usos.");
    }
    throw error;
  }

  const [{ code }] = results[1] as { code: string | null }[];

  return {
    order_id: orderId,
    code: code ?? "",
    expires_at: expiresAt,
    subtotal,
    discount,
    coupon_code: appliedCoupon,
    shipping_mode: shippingMode,
    total,
    items: lines.map(({ name, slug, color, size, qty, unit_price }) => ({
      name,
      slug,
      color,
      size,
      qty,
      unit_price,
    })),
    adjusted,
  };
}

/**
 * "Confirmar venda": ou baixa o estoque de todas as variações e marca o
 * pedido como pago, ou não faz nada.
 *
 * Diferente de fulfillOrderStock(), que ignora em silêncio uma variação
 * sem saldo (lá o pagamento já entrou), aqui a falta de estoque **aborta**:
 * ninguém pagou ainda, e o admin precisa saber que não pode vender antes
 * de responder ao cliente.
 */
export async function confirmWhatsAppOrder(orderId: string): Promise<void> {
  const db = getDb();
  const order = await db.query.orders.findFirst({
    columns: { status: true, expires_at: true },
    where: eq(orders.id, orderId),
    with: { order_items: { columns: { variant_id: true, qty: true, name: true } } },
  });

  if (!order) throw new WhatsAppOrderError("NOT_FOUND");
  if (order.status !== PENDING) throw new WhatsAppOrderError("NOT_PENDING");
  if (order.expires_at && new Date(order.expires_at).getTime() <= Date.now()) {
    // Sem marcar 'expirado' aqui: quem muda o status é a varredura, que
    // roda no reload que o painel faz depois deste erro.
    throw new WhatsAppOrderError("EXPIRED");
  }

  const items = order.order_items.filter(
    (item): item is typeof item & { variant_id: string } => item.variant_id !== null,
  );

  // Name the piece that is short, before touching anything — it is what
  // the operator will tell the customer.
  if (items.length > 0) {
    const stock = await db
      .select({ id: product_variants.id, stock: product_variants.stock })
      .from(product_variants)
      .where(inArray(product_variants.id, items.map((i) => i.variant_id)));
    const byId = new Map(stock.map((v) => [v.id, v.stock]));
    const short = items.find((item) => (byId.get(item.variant_id) ?? 0) < item.qty);
    if (short) throw new WhatsAppOrderError("OUT_OF_STOCK", short.name);
  }

  const stillPending = sql`exists (select 1 from ${orders} where ${orders.id} = ${orderId} and ${orders.status} = ${PENDING})`;

  let results;
  try {
    results = await runBatch(db, [
      // No `stock >= qty` filter on purpose: the CHECK (stock >= 0) on the
      // table makes an UPDATE that would go negative fail, and that fails
      // the whole batch — nothing is decremented.
      ...items.map((item) =>
        db
          .update(product_variants)
          .set({ stock: sql`${product_variants.stock} - ${item.qty}` })
          .where(and(eq(product_variants.id, item.variant_id), stillPending)),
      ),
      db
        .update(orders)
        .set({
          status: "paid",
          expires_at: null,
          // Mesma trava de idempotência do webhook: com ela preenchida,
          // mover o pedido depois para "em preparação"/"enviado" não baixa
          // o estoque de novo.
          stock_decremented_at: sql`coalesce(${orders.stock_decremented_at}, ${new Date().toISOString()})`,
        })
        .where(and(eq(orders.id, orderId), eq(orders.status, PENDING)))
        .returning({ id: orders.id }),
    ]);
  } catch (error) {
    // Stock changed between the check above and the batch.
    if (isCheckViolation(error, "product_variants_stock_check")) {
      throw new WhatsAppOrderError("OUT_OF_STOCK", "uma das peças");
    }
    throw error;
  }

  // Someone else confirmed (or cancelled) it in between: the guard made
  // every statement above a no-op.
  const confirmed = results[results.length - 1] as { id: string }[];
  if (confirmed.length === 0) throw new WhatsAppOrderError("NOT_PENDING");
}

/**
 * "Cancelar". Só age sobre pendentes: um pedido já confirmado teve
 * estoque baixado, e cancelar sem devolver deixaria o saldo errado. Esse
 * caso continua no fluxo normal de Pedidos.
 */
export async function cancelWhatsAppOrder(orderId: string): Promise<void> {
  const db = getDb();
  const pendingOrder = and(eq(orders.id, orderId), eq(orders.status, PENDING));
  // The order and its coupon use go back together: the use first, while
  // the order still reads as pending, in one transaction. A second click
  // matches nothing in either statement, so the use is never given back
  // twice.
  const [, cancelled] = await runBatch(db, [
    db
      .update(coupons)
      .set({ used_count: sql`max(${coupons.used_count} - 1, 0)` })
      .where(sql`${coupons.code} = (select ${orders.coupon_code} from ${orders} where ${pendingOrder})`),
    db
      .update(orders)
      .set({ status: "canceled", expires_at: null })
      .where(pendingOrder)
      .returning({ id: orders.id }),
  ]);
  if ((cancelled as { id: string }[]).length === 0) throw new WhatsAppOrderError("NOT_PENDING");
}
