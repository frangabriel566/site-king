"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCart } from "@/lib/cart/context";
import { Button } from "@/components/ui/button";
import { AuthTabs } from "@/components/shop/auth-tabs";
import { AddressFields, EMPTY_ADDRESS, type AddressFieldsValue } from "@/components/shop/address-fields";
import { OrderSummary } from "@/components/shop/order-summary";
import { EmptyState } from "@/components/shop/empty-state";
import { getCheckoutContextAction } from "@/lib/actions/checkout-context";
import { reviseCartAction, createOrderAction } from "@/lib/actions/checkout";
import { SHIPPING_METHODS, FREE_SHIPPING_THRESHOLD, type ShippingMethod } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import type { RevisedItem } from "@/lib/data/checkout";

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS: Record<Step, string> = {
  1: "Dados",
  2: "Endereço",
  3: "Frete",
  4: "Pagamento",
};

export function CheckoutWizard({ paymentProvider }: { paymentProvider: string }) {
  const { items, clear, isHydrated } = useCart();
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [loadingContext, setLoadingContext] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [address, setAddress] = useState<AddressFieldsValue>(EMPTY_ADDRESS);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("standard");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [revised, setRevised] = useState<RevisedItem[]>([]);
  const [revising, setRevising] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCheckoutContextAction().then((ctx) => {
      setAuthenticated(ctx.authenticated);
      setContact({ name: ctx.name, email: ctx.email, phone: ctx.phone });
      if (ctx.defaultAddress) setAddress(ctx.defaultAddress);
      setLoadingContext(false);
      if (ctx.authenticated && step === 1) setStep(2);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    setRevising(true);
    reviseCartAction(items.map((i) => ({ variantId: i.variantId, qty: i.qty })))
      .then((result) => {
        setRevised(result.items);
        if (result.hasChanges && items.length > 0) {
          toast.warning("Alguns itens da sacola foram ajustados por falta de estoque.");
        }
      })
      .finally(() => setRevising(false));
  }, [isHydrated, items]);

  const subtotal = useMemo(
    () => revised.reduce((sum, i) => sum + i.price * i.availableQty, 0),
    [revised],
  );

  const shippingCost =
    step >= 3
      ? subtotal >= FREE_SHIPPING_THRESHOLD
        ? 0
        : SHIPPING_METHODS[shippingMethod].price
      : null;

  async function handleFinish() {
    setSubmitting(true);
    const result = await createOrderAction({
      address,
      shippingMethod,
      couponCode: coupon?.code,
      items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    clear();
    toast.success("Pedido criado!");

    if (result.payment?.kind === "mercadopago") {
      window.location.href = result.payment.url;
      return;
    }

    if (result.payment?.kind === "whatsapp") {
      window.open(result.payment.url, "_blank", "noopener,noreferrer");
    }

    router.push(`/pedido/${result.orderId}`);
  }

  if (isHydrated && items.length === 0) {
    return (
      <EmptyState
        title="Sua sacola está vazia"
        description="Adicione produtos à sacola antes de continuar para o checkout."
        actionLabel="Ver coleção"
        actionHref="/colecao"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_380px]">
      <div>
        <ol className="mb-10 flex items-center gap-4">
          {([1, 2, 3, 4] as Step[]).map((s) => (
            <li key={s} className="flex items-center gap-2">
              <span
                className={`flex size-7 items-center justify-center rounded-full border text-xs ${
                  s === step
                    ? "border-fg bg-fg text-bg"
                    : s < step
                      ? "border-fg text-fg"
                      : "border-line text-ink-muted"
                }`}
              >
                {s}
              </span>
              <span
                className={`text-xs font-semibold uppercase tracking-wide ${
                  s === step ? "text-fg" : "text-muted-foreground"
                }`}
              >
                {STEP_LABELS[s]}
              </span>
            </li>
          ))}
        </ol>

        {authenticated && step > 1 && (
          <p className="mb-8 text-xs text-ink-muted">
            Comprando como <span className="text-fg">{contact.name || contact.email}</span>
          </p>
        )}

        {step === 1 && (
          <div>
            <h2 className="mb-6 text-xl font-bold text-fg">Seus dados</h2>
            {loadingContext ? (
              <p className="text-sm text-ink-muted">Carregando…</p>
            ) : (
              <div className="max-w-sm">
                <AuthTabs
                  variant="embedded"
                  onSuccess={() => {
                    setLoadingContext(true);
                    getCheckoutContextAction().then((ctx) => {
                      setAuthenticated(ctx.authenticated);
                      setContact({ name: ctx.name, email: ctx.email, phone: ctx.phone });
                      if (ctx.defaultAddress) setAddress(ctx.defaultAddress);
                      setLoadingContext(false);
                      setStep(2);
                    });
                  }}
                />
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="mb-6 text-xl font-bold text-fg">Endereço de entrega</h2>
            <AddressFields value={address} onChange={setAddress} idPrefix="checkout" />
            <div className="mt-8 flex gap-3">
              <Button variant="outline" size="lg" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button
                size="lg"
                onClick={() => setStep(3)}
                disabled={!address.cep || !address.street || !address.number || !address.city || !address.state}
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="mb-6 text-xl font-bold text-fg">Frete</h2>
            <div className="flex flex-col gap-3">
              {(Object.keys(SHIPPING_METHODS) as ShippingMethod[]).map((method) => {
                const info = SHIPPING_METHODS[method];
                const free = subtotal >= FREE_SHIPPING_THRESHOLD;
                return (
                  <label
                    key={method}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border p-4 text-sm transition-colors duration-150 ease-out ${
                      shippingMethod === method ? "border-fg" : "border-line hover:border-ink-muted"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="shipping"
                        checked={shippingMethod === method}
                        onChange={() => setShippingMethod(method)}
                        className="accent-fg"
                      />
                      <span>
                        {info.label}
                        <span className="block text-xs text-ink-muted">{info.etaDays}</span>
                      </span>
                    </span>
                    <span>{free ? "Grátis" : formatCurrency(info.price)}</span>
                  </label>
                );
              })}
            </div>
            <div className="mt-8 flex gap-3">
              <Button variant="outline" size="lg" onClick={() => setStep(2)}>
                Voltar
              </Button>
              <Button size="lg" onClick={() => setStep(4)}>
                Continuar
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="mb-6 text-xl font-bold text-fg">Pagamento</h2>
            <p className="max-w-sm text-sm text-ink-muted">
              {paymentProvider === "whatsapp"
                ? "Ao confirmar, você será direcionado ao WhatsApp para concluir o pagamento com a King Store."
                : "Ao confirmar, você será direcionado ao Mercado Pago para concluir o pagamento com segurança."}
            </p>
            <div className="mt-8 flex gap-3">
              <Button variant="outline" size="lg" onClick={() => setStep(3)}>
                Voltar
              </Button>
              <Button size="lg" onClick={handleFinish} disabled={submitting || revising}>
                {submitting ? "Finalizando…" : "Finalizar pedido"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <OrderSummary
        items={revised}
        subtotal={subtotal}
        shipping={shippingCost}
        coupon={coupon}
        onCouponChange={setCoupon}
      />
    </div>
  );
}
