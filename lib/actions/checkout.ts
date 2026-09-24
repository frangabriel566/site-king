"use server";

import { createClient } from "@/lib/supabase/server";
import { getCartStock, reviseCartItems, type ReviseCartResult } from "@/lib/data/checkout";
import { addressSchema } from "@/lib/validations/address";
import {
  getPaymentProvider,
  resolvePaymentMethod,
  type PaymentInitResult,
} from "@/lib/payments";
import {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_METHODS,
  isCheckoutMethod,
  type CheckoutMethod,
  type ShippingMethod,
} from "@/lib/constants";

export async function reviseCartAction(
  items: { variantId: string; qty: number }[],
): Promise<ReviseCartResult> {
  return reviseCartItems(items);
}

/** O que a sacola usa para travar o botão "+" no que existe de verdade. */
export async function getCartStockAction(
  variantIds: string[],
): Promise<Record<string, number>> {
  return getCartStock(variantIds);
}

export type CouponResult =
  | { ok: true; code: string; discount: number }
  | { ok: false; message: string };

export async function applyCouponAction(
  code: string,
  subtotal: number,
): Promise<CouponResult> {
  if (!code.trim()) return { ok: false, message: "Informe um cupom." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("validate_coupon", {
    p_code: code.trim(),
    p_subtotal: subtotal,
  });

  if (error || !data || data.length === 0) {
    return { ok: false, message: "Cupom inválido ou não aplicável." };
  }

  const coupon = data[0];
  return { ok: true, code: coupon.code, discount: coupon.discount };
}

export type CreateOrderInput = {
  address: {
    cep: string;
    street: string;
    number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
  };
  shippingMethod: ShippingMethod;
  /** Where the shopper chose to finish paying. Omitted means "whatever the
   * store is configured for", which is how this behaved before the choice
   * existed. */
  method?: CheckoutMethod;
  couponCode?: string;
  items: { variantId: string; qty: number }[];
};

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNumber: number; payment: PaymentInitResult | null }
  | { ok: false; message: string };

export async function createOrderAction(
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Você precisa entrar para finalizar a compra." };
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!customer) {
    return { ok: false, message: "Complete seu cadastro antes de continuar." };
  }

  const addressParsed = addressSchema.safeParse({
    ...input.address,
    is_default: false,
  });
  if (!addressParsed.success) {
    return { ok: false, message: "Endereço inválido." };
  }

  const revision = await reviseCartItems(input.items);
  if (revision.items.length === 0) {
    return {
      ok: false,
      message: "Sua sacola está vazia ou os itens não estão mais disponíveis.",
    };
  }

  const subtotal = revision.subtotal;

  let discount = 0;
  if (input.couponCode) {
    const { data: coupons } = await supabase.rpc("validate_coupon", {
      p_code: input.couponCode,
      p_subtotal: subtotal,
    });
    if (coupons && coupons.length > 0) discount = coupons[0].discount;
  }

  // Resolved before the insert so the row records the route the order
  // actually took, not the route that was asked for — the two differ when
  // the store has no online checkout configured.
  const paymentMethod = resolvePaymentMethod(
    isCheckoutMethod(input.method) ? input.method : undefined,
  );

  const shippingInfo = SHIPPING_METHODS[input.shippingMethod];
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : shippingInfo.price;
  const total = Math.max(subtotal + shipping - discount, 0);

  const { count: existingAddresses } = await supabase
    .from("addresses")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", user.id);

  await supabase.from("addresses").insert({
    ...addressParsed.data,
    customer_id: user.id,
    is_default: (existingAddresses ?? 0) === 0,
  });

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: user.id,
      status: "pending",
      subtotal,
      shipping,
      discount,
      total,
      payment_method: paymentMethod,
      shipping_address: addressParsed.data,
      customer_snapshot: {
        name: customer.name,
        email: user.email,
        phone: customer.phone,
      },
    })
    .select("id, order_number")
    .single();

  if (orderError || !order) {
    return { ok: false, message: "Não foi possível criar o pedido." };
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    revision.items.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      variant_id: item.variantId,
      name: item.name,
      color: item.color,
      size: item.size,
      unit_price: item.price,
      qty: item.availableQty,
    })),
  );

  if (itemsError) {
    return { ok: false, message: "Não foi possível registrar os itens do pedido." };
  }

  try {
    const provider = getPaymentProvider(
      isCheckoutMethod(input.method) ? input.method : undefined,
    );
    const payment = await provider.createPayment({
      orderId: order.id,
      orderNumber: order.order_number,
      total,
      customerName: customer.name,
      customerEmail: user.email ?? "",
      items: revision.items.map((item) => ({
        name: item.name,
        qty: item.availableQty,
        unitPrice: item.price,
      })),
    });

    return { ok: true, orderId: order.id, orderNumber: order.order_number, payment };
  } catch {
    // The order already exists — the shopper can still reach it and pay
    // later (e.g. by re-visiting /pedido/[id]) even if the payment
    // provider call itself failed.
    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.order_number,
      payment: null,
    };
  }
}
