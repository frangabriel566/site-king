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
import { CHECKOUT_METHODS, type CheckoutMethod } from "@/lib/constants";
import { shippingModeFor } from "@/lib/orders/summary";
import { useShopConfig } from "@/components/shop/shop-config-provider";
import type { RevisedItem } from "@/lib/data/checkout";
import { useBagCoupon } from "@/lib/hooks/use-bag-coupon";
import { useCartStock } from "@/lib/hooks/use-cart-stock";

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS: Record<Step, string> = {
  1: "Dados",
  2: "Endereço",
  3: "Frete",
  4: "Pagamento",
};

export function CheckoutWizard({
  onlineAvailable,
  initialMethod,
}: {
  /** False when the store has no online checkout configured — then there
   * is nothing to choose between and the payment step says so instead of
   * offering an option that can't be honoured. */
  onlineAvailable: boolean;
  /** Pre-selected from the product page, which is where the shopper picks
   * between paying here and finishing on WhatsApp. They can still change
   * it below — the order is only created at the end of this wizard. */
  initialMethod: CheckoutMethod;
}) {
  const { items, clear, isHydrated } = useCart();
  const router = useRouter();
  // The free-shipping rule the server applies again in createOrderAction.
  const { freeShippingThreshold } = useShopConfig();

  const [step, setStep] = useState<Step>(1);
  const [loadingContext, setLoadingContext] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [address, setAddress] = useState<AddressFieldsValue>(EMPTY_ADDRESS);
  const [checkoutMethod, setCheckoutMethod] = useState<CheckoutMethod>(initialMethod);
  // The coupon applied in the bag comes along; it can also be applied or
  // removed here, in the summary.
  const coupon = useBagCoupon();
  // Not for the numbers: it repoints bag lines saved with a variant id that
  // no longer exists (same product, color and size) before the order is
  // priced — see useCartStock.
  useCartStock(items);
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

  // The store's rule or a free-shipping coupon, else agreed on WhatsApp —
  // createOrderAction prices it the same way (lib/orders/pricing.ts). The
  // Melhor Envio quote will replace "a combinar" here.
  const shippingMode = shippingModeFor(
    subtotal,
    freeShippingThreshold,
    Boolean(coupon.applied?.freeShipping),
  );
  // Online payment takes the whole bill, and a freight still to be agreed
  // isn't in it: the server refuses it too.
  const canPayOnline = onlineAvailable && shippingMode !== "to_agree";

  async function handleFinish() {
    setSubmitting(true);
    const result = await createOrderAction({
      address,
      method: canPayOnline ? checkoutMethod : "whatsapp",
      couponCode: coupon.applied?.code ?? undefined,
      items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
    });
    setSubmitting(false);

    if (!result.ok) {
      // The coupon stopped applying between the summary and the order:
      // off it comes, the summary shows the real total, and the shopper
      // decides again.
      if (result.couponRejected) coupon.remove();
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
        {/* On a phone only the current step keeps its name on screen (the
            others stay readable to screen readers): the four names side by
            side are wider than a 375px screen and pushed the whole page
            sideways. */}
        <ol className="mb-10 flex items-center gap-3 sm:gap-4">
          {([1, 2, 3, 4] as Step[]).map((s) => (
            <li key={s} aria-current={s === step ? "step" : undefined} className="flex items-center gap-2">
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
                  s === step ? "text-fg" : "sr-only text-muted-foreground sm:not-sr-only"
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
            {/* No price and nothing to pick: with no quote, the freight is
                free (the store's rule or the coupon) or agreed on WhatsApp. */}
            <p
              className={`rounded-lg border border-line p-4 text-sm ${
                shippingMode === "free" ? "font-semibold text-buy" : "text-fg"
              }`}
            >
              {shippingMode === "free" ? "Frete grátis" : "Frete a combinar pelo WhatsApp"}
            </p>
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

            {canPayOnline ? (
              <>
                <p className="mb-4 max-w-sm text-sm text-ink-muted">
                  Escolha como quer finalizar. O pedido é registrado do mesmo
                  jeito nos dois casos.
                </p>
                <div className="flex flex-col gap-3">
                  {(Object.keys(CHECKOUT_METHODS) as CheckoutMethod[]).map((option) => {
                    const info = CHECKOUT_METHODS[option];
                    return (
                      <label
                        key={option}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 text-sm transition-colors duration-150 ease-out ${
                          checkoutMethod === option
                            ? "border-fg"
                            : "border-line hover:border-ink-muted"
                        }`}
                      >
                        <input
                          type="radio"
                          name="checkout-method"
                          checked={checkoutMethod === option}
                          onChange={() => setCheckoutMethod(option)}
                          className="mt-0.5 accent-fg"
                        />
                        <span>
                          {info.label}
                          <span className="block text-xs text-ink-muted">
                            {info.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="max-w-sm text-sm text-ink-muted">
                Ao confirmar, você será direcionado ao WhatsApp para concluir o
                pagamento com a King Store.
              </p>
            )}

            <div className="mt-8 flex gap-3">
              <Button variant="outline" size="lg" onClick={() => setStep(3)}>
                Voltar
              </Button>
              <Button
                size="lg"
                className="bg-buy text-white hover:bg-buy-hover"
                onClick={handleFinish}
                disabled={submitting || revising}
              >
                {submitting ? "Finalizando…" : "Finalizar pedido"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <OrderSummary
        items={revised}
        subtotal={subtotal}
        shippingMode={shippingMode}
        coupon={coupon}
      />
    </div>
  );
}
