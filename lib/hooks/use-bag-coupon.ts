"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart/context";
import type { CouponOffer, CouponValidationResponse } from "@/lib/coupons/rules";

export type AppliedCoupon = {
  code: string;
  /** In reais, for this bag (0 on the product page, which has no bag). */
  discount: number;
  freeShipping: boolean;
  /** What the coupon gives ("-10%"), for the "aplicado" line. */
  offer: CouponOffer;
};

/** A good coupon the bag is still short of: kept, not applied. */
export type WaitingCoupon = { code: string; missing: number; offer: CouponOffer };

export type BagCoupon = {
  /** Validated by the server for the bag as it is now; null otherwise. */
  applied: AppliedCoupon | null;
  /** Kept with the bag but under its minimum: "Faltam R$ X". It applies by
   * itself once the bag reaches it. */
  waiting: WaitingCoupon | null;
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

export async function validateCoupon(
  code: string,
  items: { variantId: string; qty: number }[],
): Promise<CouponValidationResponse> {
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
 * from the product page and the ?cupom= link to the bag, the drawer, the
 * checkout and the WhatsApp order.
 *
 * Changing a quantity or a size re-asks the server. Under the coupon's
 * minimum it stays kept ("Faltam R$ X") and applies by itself when the bag
 * gets there; a coupon that stops applying for good (expired, out of uses)
 * is taken off with a warning saying why. Changing the CEP doesn't touch
 * it: the coupon is about the products, not the address.
 *
 * @param enabled The drawer is mounted on every page; it only asks while
 * open, like its stock lookup.
 * @param mode "offer": the product page — the coupon alone, before there
 * is a bag to price ("Cupom X aplicado: -10%").
 */
export function useBagCoupon(enabled = true, mode: "bag" | "offer" = "bag"): BagCoupon {
  const { items, couponCode, setCouponCode, isHydrated } = useCart();
  const [applied, setApplied] = useState<AppliedCoupon | null>(null);
  const [waiting, setWaiting] = useState<WaitingCoupon | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = useMemo(
    () =>
      mode === "offer" ? [] : items.map((item) => ({ variantId: item.variantId, qty: item.qty })),
    [items, mode],
  );
  const bagKey = useMemo(
    () => lines.map((line) => `${line.variantId}:${line.qty}`).sort().join(","),
    [lines],
  );
  // "code|bag" last confirmed by the server — an apply() already checked
  // this exact bag, so the effect below doesn't ask a second time.
  const checked = useRef<string | null>(null);

  const take = useCallback((result: CouponValidationResponse, key: string): boolean => {
    if (result.ok) {
      checked.current = key;
      setApplied({
        code: result.code,
        discount: result.discount,
        freeShipping: result.freeShipping,
        offer: result.offer,
      });
      setWaiting(null);
      return true;
    }
    if (result.reason === "BELOW_MINIMUM" && result.offer && result.missing !== undefined) {
      checked.current = key;
      setApplied(null);
      setWaiting({ code: result.offer.code, missing: result.missing, offer: result.offer });
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (!enabled || !isHydrated) return;
    if (!couponCode) {
      setApplied(null);
      setWaiting(null);
      return;
    }
    // An empty bag keeps the code: there is nothing to price, and the
    // coupon comes back to life when something is added.
    if (mode === "bag" && lines.length === 0) {
      setApplied(null);
      setWaiting(null);
      return;
    }
    const key = `${couponCode}|${bagKey}`;
    if (checked.current === key) return;

    let alive = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await validateCoupon(couponCode, lines);
        if (!alive || take(result, key)) return;
        if (!result.ok && result.reason === "RATE_LIMITED") return;
        checked.current = null;
        setApplied(null);
        setWaiting(null);
        setCouponCode(null);
        // One toast however many places (page, drawer) noticed it.
        toast.warning(`Cupom ${couponCode} removido`, {
          id: "coupon-removed",
          description: result.ok ? undefined : result.message,
        });
      } catch {
        // Offline for a moment: keep the coupon. The order checks it again
        // on the server either way.
      } finally {
        if (alive) setLoading(false);
      }
    }, applied || waiting ? REVALIDATE_DELAY_MS : 0);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // `applied`/`waiting` only pick the delay; they must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isHydrated, couponCode, bagKey, lines, setCouponCode, mode, take]);

  const apply = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code) {
        setError("Digite o código do cupom.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await validateCoupon(code, lines);
        const kept = result.ok ? result.code : result.offer?.code;
        if (take(result, `${kept}|${bagKey}`) && kept) {
          setCouponCode(kept);
        } else if (!result.ok) {
          setError(result.message);
        }
      } catch {
        setError("Não consegui verificar o cupom. Confira sua conexão e tente de novo.");
      } finally {
        setLoading(false);
      }
    },
    [lines, bagKey, setCouponCode, take],
  );

  const remove = useCallback(() => {
    checked.current = null;
    setApplied(null);
    setWaiting(null);
    setError(null);
    setCouponCode(null);
  }, [setCouponCode]);

  const clearError = useCallback(() => setError(null), []);

  return { applied, waiting, code: couponCode, loading, error, apply, remove, clearError };
}
