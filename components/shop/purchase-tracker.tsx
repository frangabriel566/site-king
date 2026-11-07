"use client";

import { useEffect } from "react";
import { trackPurchase, type PurchaseData } from "@/lib/analytics/events";

/**
 * Renders nothing. Sends GA4's `purchase` for an order the page has just
 * read as confirmed (paid, or confirmed by the store) — the order page is
 * only given this when that is true, so an order still waiting for its
 * payment or for WhatsApp never counts as a sale. trackPurchase keeps it to
 * once per order in this browser.
 */
export function PurchaseTracker({ purchase }: { purchase: PurchaseData }) {
  useEffect(() => {
    trackPurchase(purchase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchase.transactionId]);
  return null;
}
