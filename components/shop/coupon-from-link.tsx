"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { useCart } from "@/lib/cart/context";
import { validateCoupon } from "@/lib/hooks/use-bag-coupon";

/** The query parameter of a coupon link: sitekingstore.com.br/?cupom=CODIGO. */
export const COUPON_LINK_PARAM = "cupom";

/**
 * A coupon link (`?cupom=CODIGO` on any page): the code is checked, kept
 * with the bag — so it shows applied there and on the product page — and
 * announced once, discreetly. The parameter is then taken off the address,
 * so a reload or a shared link of the page doesn't announce it again.
 *
 * Mounted once, in the storefront layout. Renders nothing.
 */
export function CouponFromLink() {
  const { setCouponCode, isHydrated } = useCart();
  const pathname = usePathname();

  useEffect(() => {
    // After the saved bag (and its coupon) loaded, or it would overwrite
    // the code from the link.
    if (!isHydrated) return;
    const url = new URL(window.location.href);
    const code = url.searchParams.get(COUPON_LINK_PARAM)?.trim();
    if (!code) return;
    url.searchParams.delete(COUPON_LINK_PARAM);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);

    validateCoupon(code, [])
      .then((result) => {
        if (result.ok) {
          setCouponCode(result.code);
          toast.success(`Cupom ${result.code} aplicado`, { id: "coupon-link" });
        } else {
          toast.error(result.message, { id: "coupon-link" });
        }
      })
      .catch(() => {
        // Offline: the link can be opened again.
      });
  }, [isHydrated, pathname, setCouponCode]);

  return null;
}
