"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCart } from "@/lib/cart/context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CouponField } from "@/components/shop/coupon-field";
import { AuthTabs } from "@/components/shop/auth-tabs";
import { AddressFields, EMPTY_ADDRESS, type AddressFieldsValue } from "@/components/shop/address-fields";
import { OrderSummary } from "@/components/shop/order-summary";
import { EmptyState } from "@/components/shop/empty-state";
import { getCheckoutContextAction } from "@/lib/actions/checkout-context";
import {
  reviseCartAction,
  createOrderAction,
  quoteCheckoutFreightAction,
} from "@/lib/actions/checkout";
import { formatCurrency } from "@/lib/format";
import type { ShippingQuote } from "@/lib/shipping/melhor-envio";
import { CHECKOUT_METHODS, type CheckoutMethod } from "@/lib/constants";
import { cheapestFreight, freightCharge, shippingModeFor } from "@/lib/orders/summary";
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
  // "Você tem cupom de desconto?" — asked once the shopper finishes,
  // instead of a field in the summary (pedido do dono da loja).
  const [couponAsk, setCouponAsk] = useState(false);
  // The Frete step: Melhor Envio options for the address's CEP and the bag
  // as the server has it. `quotedFor` is what they were quoted against —
  // a different CEP or bag asks again.
  const [quotes, setQuotes] = useState<ShippingQuote[] | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quotedFor, setQuotedFor] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<number | null>(null);

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

  // The store's rule or a free-shipping coupon decides whether the cheapest
  // option is free; createOrderAction charges the same way
  // (lib/orders/pricing.ts → freightCharge).
  const freeShippingApplies =
    shippingModeFor(subtotal, freeShippingThreshold, Boolean(coupon.applied?.freeShipping)) === "free";
  const charge =
    quotes && serviceId !== null ? freightCharge(quotes, serviceId, freeShippingApplies) : null;
  const chosenQuote = quotes?.find((q) => q.serviceId === serviceId) ?? null;
  const shippingMode = charge?.shippingMode ?? "charged";
  const shipping = charge?.shipping ?? 0;
  const canPayOnline = onlineAvailable && charge !== null;

  const quoteKey = `${address.cep.replace(/\D/g, "")}|${items
    .map((i) => `${i.variantId}:${i.qty}`)
    .join(",")}`;

  async function loadQuotes() {
    setQuoting(true);
    setQuoteError(null);
    const result = await quoteCheckoutFreightAction(
      address.cep,
      items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
    );
    setQuoting(false);
    setQuotedFor(quoteKey);
    if (!result.ok) {
      setQuotes(null);
      setServiceId(null);
      setQuoteError(result.message);
      return;
    }
    setQuotes(result.quotes);
    // Keeps the pick if it is still offered; else the cheapest.
    setServiceId((current) =>
      current !== null && result.quotes.some((q) => q.serviceId === current)
        ? current
        : (cheapestFreight(result.quotes)?.serviceId ?? null),
    );
  }

  useEffect(() => {
    if (step === 3 && !revising && quotedFor !== quoteKey && !quoting) void loadQuotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, revising, quoteKey]);

  function requestFinish() {
    // A coupon already applied (in the bag, or just now) needs no question.
    if (coupon.applied) void handleFinish();
    else setCouponAsk(true);
  }

  async function handleFinish() {
    setCouponAsk(false);
    setSubmitting(true);
    const result = await createOrderAction({
      address,
      method: canPayOnline ? checkoutMethod : "whatsapp",
      couponCode: coupon.applied?.code ?? undefined,
      freight:
        serviceId !== null && charge ? { serviceId, expectedPrice: charge.shipping } : undefined,
      items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
    });
    setSubmitting(false);

    if (!result.ok) {
      // The coupon stopped applying between the summary and the order:
      // off it comes, the summary shows the real total, and the shopper
      // decides again.
      if (result.couponRejected) coupon.remove();
      // The freight changed under the shopper: back to the Frete step with
      // fresh options.
      if (result.freightChanged) {
        setQuotedFor(null);
        setStep(3);
      }
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
            {quoting || revising ? (
              <p className="text-sm text-ink-muted">Calculando o frete para o CEP {address.cep}…</p>
            ) : quoteError ? (
              <div className="rounded-lg border border-line p-4 text-sm">
                <p className="text-fg">{quoteError}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => void loadQuotes()}>
                  Tentar de novo
                </Button>
              </div>
            ) : quotes ? (
              <div className="flex flex-col gap-3" role="radiogroup" aria-label="Opções de frete">
                {quotes.map((quote) => {
                  const price = freightCharge(quotes, quote.serviceId, freeShippingApplies);
                  const selected = serviceId === quote.serviceId;
                  return (
                    <label
                      key={quote.serviceId}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 text-sm transition-colors duration-150 ease-out ${
                        selected ? "border-fg" : "border-line hover:border-ink-muted"
                      }`}
                    >
                      <input
                        type="radio"
                        name="freight-option"
                        checked={selected}
                        onChange={() => setServiceId(quote.serviceId)}
                        className="accent-fg"
                      />
                      <span className="min-w-0 flex-1">
                        {[quote.company, quote.name].filter(Boolean).join(" ")}
                        <span className="block text-xs text-ink-muted">
                          Até {quote.deliveryDays} {quote.deliveryDays === 1 ? "dia útil" : "dias úteis"} após a postagem
                        </span>
                      </span>
                      <span
                        className={
                          price?.shippingMode === "free" ? "font-semibold text-buy" : "font-semibold text-fg"
                        }
                      >
                        {price?.shippingMode === "free" ? "Grátis" : formatCurrency(price?.shipping ?? quote.price)}
                      </span>
                    </label>
                  );
                })}
                {freeShippingApplies && quotes.length > 1 && (
                  <p className="text-xs text-ink-muted">O frete grátis vale para a opção mais barata.</p>
                )}
              </div>
            ) : null}
            <div className="mt-8 flex gap-3">
              <Button variant="outline" size="lg" onClick={() => setStep(2)}>
                Voltar
              </Button>
              <Button size="lg" onClick={() => setStep(4)} disabled={!charge || quoting}>
                Continuar
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="mb-6 text-xl font-bold text-fg">Pagamento</h2>

            {charge && (
              <p className="mb-4 max-w-sm text-sm text-ink-muted">
                Frete:{" "}
                <span className="text-fg">
                  {[chosenQuote?.company, chosenQuote?.name].filter(Boolean).join(" ")}{" "}
                  — {charge.shippingMode === "free" ? "grátis" : formatCurrency(charge.shipping)}
                </span>
              </p>
            )}

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
                onClick={requestFinish}
                disabled={submitting || revising || !charge}
              >
                {submitting ? "Finalizando…" : "Finalizar pedido"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={couponAsk} onOpenChange={setCouponAsk}>
        <DialogContent className="storefront-theme bg-white text-fg sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Você tem cupom de desconto?</DialogTitle>
            <DialogDescription>Se tiver, adicione aqui antes de finalizar.</DialogDescription>
          </DialogHeader>
          <CouponField coupon={coupon} />
          <div className="mt-2 flex flex-col gap-2">
            {coupon.applied ? (
              <Button
                size="lg"
                className="w-full bg-buy text-white hover:bg-buy-hover"
                onClick={() => void handleFinish()}
                disabled={submitting}
              >
                Finalizar com o cupom
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={() => void handleFinish()}
                disabled={submitting || coupon.loading}
              >
                Não tenho cupom, finalizar
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <OrderSummary
        items={revised}
        subtotal={subtotal}
        shippingMode={shippingMode}
        shipping={shipping}
        shippingPending={charge ? undefined : "calculado no passo Frete"}
        coupon={coupon}
      />
    </div>
  );
}
