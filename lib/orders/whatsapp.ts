import "server-only";
import { and, eq, inArray, isNotNull, lte, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { insertChunks, runBatch } from "@/lib/db/batch";
import { isCheckViolation } from "@/lib/db/errors";
import { WHATSAPP_CODE_COUNTER, currentWhatsAppCode, nextOrderNumber } from "@/lib/db/sequences";
import { roundMoney } from "@/lib/money";
import type { CustomerSnapshot } from "@/lib/db/schema";
import { countCouponUse, isCouponLimitError } from "@/lib/coupons/usage";
import { getSiteSettings } from "@/lib/data/settings";
import { priceOrder } from "@/lib/orders/pricing";
import { orderTotal, shippingModeFor } from "@/lib/orders/summary";
import type { ShippingMode } from "@/lib/shipping-mode";

/**
 * Compra direta pelo WhatsApp — the four Postgres functions of migration
 * 0014 (create/confirm/cancel/expire), as server code over D1 batches.
 * Callers do the permission checks: creating is open to anyone (a guest
 * can buy), confirming and cancelling are admin-only (lib/auth/guards.ts).
 */

const { orders, order_items, product_variants, customers, user, counters, coupons } = schema;

/** A customer's name as typed before opening WhatsApp. */
export const CUSTOMER_NAME_MAX = 80;

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
  | "COUPON"
  /** Confirming: the coupon reached its limit with other confirmed sales.
   * detail: the coupon's code. */
  | "COUPON_LIMIT";

export class WhatsAppOrderError extends Error {
  constructor(
    readonly code: WhatsAppOrderErrorCode,
    /** For OUT_OF_STOCK: the name of the piece that ran out. For COUPON:
     * the reason, ready for the shopper. For COUPON_LIMIT: the code. */
    readonly detail?: string,
    /** For COUPON: what the order comes to without the coupon, so the
     * shopper sees the new total before going on. */
    readonly totalWithoutCoupon?: number,
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
  // No coupon to give back: a use only counts once the sale is confirmed
  // (lib/coupons/usage.ts), and these never were.
  const expired = await db
    .update(orders)
    .set({ status: "expirado" })
    .where(due)
    .returning({ id: orders.id });
  return expired.length;
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
  /** As typed before opening WhatsApp, or the account's; null when none. */
  customer_name: string | null;
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
  customerName: string | null = null,
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
  // os outros seguem como visitante, com o nome que digitaram antes de
  // abrir a conversa. O nome digitado vale também para quem tem conta: é
  // como o cliente quer ser chamado.
  const typedName = customerName?.trim().slice(0, CUSTOMER_NAME_MAX) || null;
  let customerId: string | null = null;
  let snapshot: CustomerSnapshot | null = typedName ? { name: typedName } : null;
  if (userId) {
    const [row] = await db
      .select({ name: customers.name, phone: customers.phone, email: user.email })
      .from(customers)
      .innerJoin(user, eq(user.id, customers.id))
      .where(eq(customers.id, userId));
    if (row) {
      customerId = userId;
      snapshot = { name: typedName ?? row.name, email: row.email, phone: row.phone };
    }
  }

  // Sem valor de frete de propósito: este caminho não pede endereço, e o
  // frete é combinado na conversa — ou é grátis, pela regra da loja ou
  // pelo cupom. O cupom aplicado na sacola é conferido de novo contra o
  // subtotal do banco: o que a sacola mostrou foi só a prévia.
  const subtotal = roundMoney(lines.reduce((sum, l) => sum + l.unit_price * l.qty, 0));
  const priced = await priceOrder(subtotal, couponCode);
  if (!priced.ok) {
    const without = await priceOrder(subtotal, null);
    throw new WhatsAppOrderError(
      "COUPON",
      priced.message,
      without.ok ? without.pricing.total : undefined,
    );
  }
  const { discount, couponCode: appliedCoupon, shippingMode, total } = priced.pricing;
  const orderId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + EXPIRY_MS).toISOString();

  // Sem uso de cupom aqui: ele só conta quando a venda é confirmada
  // (lib/coupons/usage.ts) — um pedido que expira não gasta o limite.
  const results = await runBatch(db, [
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
  ]);

  const [{ code }] = results[1] as { code: string | null }[];

  return {
    order_id: orderId,
    code: code ?? "",
    expires_at: expiresAt,
    subtotal,
    discount,
    coupon_code: appliedCoupon,
    shipping_mode: shippingMode,
    customer_name: snapshot?.name ?? null,
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
export async function confirmWhatsAppOrder(
  orderId: string,
  /** Digits with DDD, typed by the store (optional): kept on the order,
   * and what "um uso por telefone" compares. */
  customerPhone: string | null = null,
): Promise<void> {
  const db = getDb();
  const order = await db.query.orders.findFirst({
    columns: { status: true, expires_at: true, coupon_code: true },
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
      // O uso do cupom conta aqui, na venda (lib/coupons/usage.ts) — antes
      // da troca de status, enquanto o pedido ainda está pendente. Passou
      // do limite: o lote inteiro volta, estoque inclusive.
      ...countCouponUse(db, orderId, PENDING),
      db
        .update(orders)
        .set({
          status: "paid",
          expires_at: null,
          customer_phone: customerPhone,
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
    if (isCouponLimitError(error)) {
      throw new WhatsAppOrderError("COUPON_LIMIT", order.coupon_code ?? undefined);
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
  // Nenhum uso de cupom a devolver: pendente nunca contou um.
  const cancelled = await getDb()
    .update(orders)
    .set({ status: "canceled", expires_at: null })
    .where(and(eq(orders.id, orderId), eq(orders.status, PENDING)))
    .returning({ id: orders.id });
  if (cancelled.length === 0) throw new WhatsAppOrderError("NOT_PENDING");
}

/**
 * "Remover desconto", antes de confirmar: o pedido volta ao preço sem o
 * cupom. O frete segue a regra da loja (o grátis do cupom sai com ele). Só
 * em pedido pendente — um confirmado já contou o uso e já foi cobrado.
 */
export async function removeWhatsAppOrderDiscount(orderId: string): Promise<void> {
  const db = getDb();
  const order = await db.query.orders.findFirst({
    columns: { status: true, subtotal: true, coupon_code: true },
    where: eq(orders.id, orderId),
  });
  if (!order) throw new WhatsAppOrderError("NOT_FOUND");
  if (order.status !== PENDING) throw new WhatsAppOrderError("NOT_PENDING");
  if (!order.coupon_code) return;

  const { free_shipping_threshold } = await getSiteSettings();
  const shippingMode = shippingModeFor(order.subtotal, free_shipping_threshold, false);
  const updated = await db
    .update(orders)
    .set({
      coupon_code: null,
      discount: 0,
      shipping_mode: shippingMode,
      total: orderTotal({ subtotal: order.subtotal, discount: 0, shippingMode }),
    })
    .where(and(eq(orders.id, orderId), eq(orders.status, PENDING)))
    .returning({ id: orders.id });
  if (updated.length === 0) throw new WhatsAppOrderError("NOT_PENDING");
}

export type CouponPhoneCheck = {
  /** The order's coupon, when it is one-use-per-phone. */
  couponCode: string | null;
  /** Other confirmed orders where this phone used that coupon. */
  previous: { id: string; label: string }[];
};

/**
 * "Um uso por telefone": the confirmed orders where `phone` already used
 * this order's coupon. A warning for the store, never a block — the phone
 * is typed by hand and may be shared.
 */
export async function findCouponPhoneUses(orderId: string, phone: string): Promise<CouponPhoneCheck> {
  const db = getDb();
  const order = await db.query.orders.findFirst({
    columns: { coupon_code: true },
    where: eq(orders.id, orderId),
  });
  if (!order?.coupon_code) return { couponCode: null, previous: [] };
  const coupon = await db.query.coupons.findFirst({
    columns: { one_per_phone: true },
    where: eq(coupons.code, order.coupon_code),
  });
  if (!coupon?.one_per_phone) return { couponCode: null, previous: [] };

  const rows = await db
    .select({ id: orders.id, code: orders.code, number: orders.order_number })
    .from(orders)
    .where(
      and(
        eq(orders.coupon_code, order.coupon_code),
        eq(orders.customer_phone, phone),
        isNotNull(orders.coupon_used_at),
        ne(orders.id, orderId),
      ),
    )
    .limit(5);
  return {
    couponCode: order.coupon_code,
    previous: rows.map((row) => ({ id: row.id, label: `#${row.code ?? row.number}` })),
  };
}
