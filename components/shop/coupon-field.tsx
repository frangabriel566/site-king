"use client";

import { useState, type FormEvent } from "react";
import { Loader2, TicketPercent, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { BagCoupon } from "@/lib/hooks/use-bag-coupon";

/**
 * "Cupom de desconto" — sits right under the CEP in the bag and in the
 * checkout summary. Typed code in, the server's answer out: applied (code,
 * how much it saves, remove), or why it didn't apply, in red under the
 * field. The state lives in useBagCoupon so the totals next to it update
 * from the same answer.
 */
export function CouponField({ coupon, className = "" }: { coupon: BagCoupon; className?: string }) {
  const [code, setCode] = useState("");
  const errorId = "coupon-error";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await coupon.apply(code);
  }

  if (coupon.applied) {
    const { applied } = coupon;
    return (
      <div className={className}>
        <div className="flex items-center gap-3 rounded-lg border border-buy/40 bg-buy/5 px-3 py-2.5">
          <TicketPercent className="size-5 shrink-0 text-buy" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm leading-snug" aria-live="polite">
            Cupom <strong className="font-bold tracking-wide">{applied.code}</strong> aplicado
            <span className="block text-xs font-semibold text-buy">
              {applied.discount > 0 && <>Você economiza {formatCurrency(applied.discount)}</>}
              {applied.discount > 0 && applied.freeShipping && " e o frete"}
              {applied.discount === 0 && applied.freeShipping && "Frete grátis"}
            </span>
          </p>
          <button
            type="button"
            onClick={() => {
              coupon.remove();
              setCode("");
            }}
            className="flex min-h-11 shrink-0 touch-manipulation items-center gap-1 px-1 text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-fg"
          >
            <X className="size-3.5" aria-hidden="true" />
            Remover
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <label htmlFor="coupon-code" className="mb-2 flex items-center gap-2 text-sm font-medium text-fg">
        <TicketPercent className="size-4" aria-hidden="true" />
        Cupom de desconto
      </label>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          id="coupon-code"
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
