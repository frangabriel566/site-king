"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart/context";
import type { CouponValidationResponse } from "@/lib/coupons/rules";

export type AppliedCoupon = { code: string; discount: number; freeShipping: boolean };

export type BagCoupon = {
  /** Validated by the server for the bag as it is now; null otherwise. */
  applied: AppliedCoupon | null;
  /** The code kept with the bag (may still be revalidating). */
  code: string | null;
  loading: boolean;
  /** Why the last code typed didn't apply, in Portuguese. */
  error: string | null;
  apply: (code: string) => Promise<void>;
  remove: () => void;
  clearError: () => void;
};

/** Only after the shopper stops tapping +/−: one request per pause. */
const REVALIDATE_DELAY_MS = 400;

async function validate(code: string, items: { variantId: string; qty: number }[]) {
  const response = await fetch("/api/coupons/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, items }),
  });
  return (await response.json()) as CouponValidationResponse;
}

/**
 * The bag's coupon: apply, remove, and keep it honest as the bag changes.
 *
 * The amount always comes from the server, which prices the bag from the
 * database (/api/coupons/validate) — nothing here computes a discount.
 * The code itself lives in the cart context, so it follows the shopper
 * from the bag to the drawer, the checkout and the WhatsApp order.
 *
 * Changing a quantity or a size re-asks the server. A coupon that stops
 * applying (the subtotal dropped under its minimum, it expired meanwhile)
 * is taken off with a warning saying why. Changing the CEP doesn't touch
 * it: the coupon is about the products, not the address.
 *
 * @param enabled The drawer is mounted on every page; it only asks while
 * open, like its stock lookup.
 */
export function useBagCoupon(enabled = true): BagCoupon {
  const { items, couponCode, setCouponCode, isHydrated } = useCart();
  const [applied, setApplied] = useState<AppliedCoupon | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = useMemo(
    () => items.map((item) => ({ variantId: item.variantId, qty: item.qty })),
    [items],
  );
  const bagKey = useMemo(
    () => lines.map((line) => `${line.variantId}:${line.qty}`).sort().join(","),
    [lines],
  );
  // "code|bag" last confirmed by the server — an apply() already checked
  // this exact bag, so the effect below doesn't ask a second time.
  const checked = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !isHydrated) return;
    if (!couponCode) {
      setApplied(null);
      return;
    }
    // An empty bag keeps the code: there is nothing to price, and the
    // coupon comes back to life when something is added.
    if (lines.length === 0) {
      setApplied(null);
      return;
    }
    const key = `${couponCode}|${bagKey}`;
    if (checked.current === key) return;

    let alive = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await validate(couponCode, lines);
        if (!alive) return;
        if (result.ok) {
          checked.current = key;
          setApplied({ code: result.code, discount: result.discount, freeShipping: result.freeShipping });
        } else {
          checked.current = null;
          setApplied(null);
          setCouponCode(null);
          // One toast however many places (page, drawer) noticed it.
          toast.warning(`Cupom ${couponCode} removido`, {
            id: "coupon-removed",
            description: result.message,
          });
        }
      } catch {
        // Offline for a moment: keep the coupon. The order checks it again
        // on the server either way.
      } finally {
        if (alive) setLoading(false);
      }
    }, applied ? REVALIDATE_DELAY_MS : 0);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // `applied` only picks the delay; it must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isHydrated, couponCode, bagKey, lines, setCouponCode]);

  const apply = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code) {
        setError("Digite o código do cupom.");
        return;
      }
      if (lines.length === 0) {
        setError("Adicione produtos à sacola para usar um cupom.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await validate(code, lines);
        if (result.ok) {
          checked.current = `${result.code}|${bagKey}`;
          setApplied({ code: result.code, discount: result.discount, freeShipping: result.freeShipping });
          setCouponCode(result.code);
        } else {
          setError(result.message);
        }
      } catch {
        setError("Não consegui verificar o cupom. Confira sua conexão e tente de novo.");
      } finally {
        setLoading(false);
      }
    },
    [lines, bagKey, setCouponCode],
  );

  const remove = useCallback(() => {
    checked.current = null;
    setApplied(null);
    setError(null);
    setCouponCode(null);
  }, [setCouponCode]);

  const clearError = useCallback(() => setError(null), []);

  return { applied, code: couponCode, loading, error, apply, remove, clearError };
}
