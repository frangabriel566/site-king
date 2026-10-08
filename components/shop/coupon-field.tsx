"use client";

import { useId, useState, type FormEvent } from "react";
import { Loader2, TicketPercent, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { couponOfferLabel } from "@/lib/coupons/rules";
import type { BagCoupon } from "@/lib/hooks/use-bag-coupon";

/**
 * "Cupom de desconto" — in the bag, the drawer, the checkout summary and
 * the product page, with the CEP box's look (icon, field, "Aplicar").
 * Typed code in, the server's answer out: applied ("Cupom X aplicado:
 * -10%", remove), kept until the bag reaches its minimum ("Faltam R$ X"),
 * or why it didn't apply, in red under the field. The state lives in
 * useBagCoupon so the totals next to it update from the same answer.
 *
 * `collapsible`: the drawer, where the footer can't grow — a "Tem cupom?"
 * link that opens the field.
 */
export function CouponField({
  coupon,
  collapsible = false,
  className = "",
}: {
  coupon: BagCoupon;
  collapsible?: boolean;
  className?: string;
}) {
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(!collapsible);
  // The drawer and the page can both show the field at once.
  const inputId = useId();
  const errorId = useId();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await coupon.apply(code);
  }

  function remove() {
    coupon.remove();
    setCode("");
  }

  const removeButton = (
    <button
      type="button"
      onClick={remove}
      className="flex min-h-11 shrink-0 touch-manipulation items-center gap-1 px-1 text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-fg"
    >
      <X className="size-3.5" aria-hidden="true" />
      Remover
    </button>
  );

  if (coupon.applied) {
    const { applied } = coupon;
    // The product page has no bag yet: the minimum is said, not checked.
    const minimum = applied.discount === 0 && applied.offer.minTotal > 0 ? applied.offer.minTotal : null;
    return (
      <div className={className}>
        <div className="flex items-center gap-3 rounded-lg border border-buy/40 bg-buy/5 px-3 py-2.5">
          <TicketPercent className="size-5 shrink-0 text-buy" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm leading-snug" aria-live="polite">
            Cupom <strong className="font-bold tracking-wide">{applied.code}</strong> aplicado:{" "}
            <span className="font-semibold text-buy">{couponOfferLabel(applied.offer)}</span>
            {minimum !== null && (
              <span className="block text-xs text-muted-foreground">
                Em compras a partir de {formatCurrency(minimum)}
              </span>
            )}
          </p>
          {removeButton}
        </div>
      </div>
    );
  }

  if (coupon.waiting) {
    const { waiting } = coupon;
    return (
      <div className={className}>
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
          <TicketPercent className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm leading-snug" aria-live="polite">
            Faltam <strong className="font-bold text-fg">{formatCurrency(waiting.missing)}</strong>{" "}
            para usar o cupom <strong className="font-bold tracking-wide">{waiting.code}</strong>
            <span className="block text-xs text-muted-foreground">
              {couponOfferLabel(waiting.offer)} em compras a partir de{" "}
              {formatCurrency(waiting.offer.minTotal)}
            </span>
          </p>
          {removeButton}
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-11 touch-manipulation items-center gap-2 text-sm font-medium text-fg underline-offset-2 hover:underline"
        >
          <TicketPercent className="size-4" aria-hidden="true" />
          Tem cupom de desconto?
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-2 flex items-center gap-2 text-sm font-medium text-fg">
        <TicketPercent className="size-4" aria-hidden="true" />
        Cupom de desconto
      </label>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          id={inputId}
          value={code}
          onChange={(event) => {
            setCode(event.target.value.toUpperCase());
            if (coupon.error) coupon.clearError();
          }}
          placeholder="Digite o código"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="go"
          maxLength={40}
          autoFocus={collapsible}
          aria-invalid={Boolean(coupon.error)}
          aria-describedby={coupon.error ? errorId : undefined}
          className="min-w-0 flex-1 uppercase placeholder:normal-case"
        />
        <Button
          type="submit"
          variant="outline"
          disabled={coupon.loading || !code.trim()}
          className="shrink-0"
        >
          {coupon.loading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              <span className="sr-only">Aplicando</span>
            </>
          ) : (
            "Aplicar"
          )}
        </Button>
      </form>
      {coupon.error && (
        <p id={errorId} role="alert" className="mt-2 text-xs font-medium text-alert">
          {coupon.error}
        </p>
      )}
    </div>
  );
}
