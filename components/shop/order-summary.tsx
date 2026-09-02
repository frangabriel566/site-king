"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { formatCurrency, formatVariantLabel } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { applyCouponAction } from "@/lib/actions/checkout";
import type { RevisedItem } from "@/lib/data/checkout";

export function OrderSummary({
  items,
  subtotal,
  shipping,
  coupon,
  onCouponChange,
}: {
  items: RevisedItem[];
  subtotal: number;
  shipping: number | null;
  coupon: { code: string; discount: number } | null;
  onCouponChange: (coupon: { code: string; discount: number } | null) => void;
}) {
  const [code, setCode] = useState(coupon?.code ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const discount = coupon?.discount ?? 0;
  const total = Math.max(subtotal + (shipping ?? 0) - discount, 0);

  function applyCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await applyCouponAction(code, subtotal);
      if (result.ok) {
        onCouponChange({ code: result.code, discount: result.discount });
      } else {
        onCouponChange(null);
        setError(result.message);
      }
    });
  }

  return (
    <div className="h-fit rounded-lg border border-line p-6">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Resumo do pedido
      </p>

      <ul className="mb-6 flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.variantId} className="flex items-center gap-3 text-sm">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-surface">
              {item.image && (
                <Image src={item.image} alt="" fill sizes="56px" className="object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate">{item.name}</p>
              <p className="text-xs text-ink-muted">
                {[formatVariantLabel(item.color, item.size), `Qtd. ${item.availableQty}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <span>{formatCurrency(item.price * item.availableQty)}</span>
          </li>
        ))}
      </ul>

      <form onSubmit={applyCoupon} className="mb-6 flex items-center gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Cupom de desconto"
        />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "…" : "Aplicar"}
        </Button>
      </form>
      {error && <p className="mb-4 text-xs text-alert">{error}</p>}
      {coupon && (
        <p className="mb-4 text-xs text-gold-text">Cupom {coupon.code} aplicado.</p>
      )}

      <div className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-ink-muted">Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-muted">Frete</span>
          <span>
            {shipping === null ? "—" : shipping === 0 ? "Grátis" : formatCurrency(shipping)}
          </span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between">
            <span className="text-ink-muted">Desconto</span>
            <span>-{formatCurrency(discount)}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-line pt-2 text-base">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}
