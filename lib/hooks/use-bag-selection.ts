"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CartItem } from "@/lib/cart/types";

/** Line selection for the sacola (drawer and full page), where the
 *  default is "everything is selected".
 *
 *  It stores the *deselected* ids instead of the selected ones, which is
 *  what makes a just-added item arrive already ticked: a line nobody has
 *  touched is absent from the set, so it reads as selected. Keeping a set
 *  of selected ids can't do that — it starts empty and only the shopper
 *  ever adds to it, so every new item landed unchecked.
 *
 *  Ids that leave the bag are pruned, so removing a deselected variant
 *  and adding it again brings it back selected. */
export function useBagSelection(items: CartItem[]) {
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDeselectedIds((prev) => {
      if (prev.size === 0) return prev;
      const validIds = new Set(items.map((i) => i.variantId));
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const selectedIds = useMemo(
    () =>
      new Set(
        items.map((i) => i.variantId).filter((id) => !deselectedIds.has(id)),
      ),
    [items, deselectedIds],
  );

  const toggleSelect = useCallback((id: string) => {
    setDeselectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(
    (checked: boolean) => {
      setDeselectedIds(checked ? new Set() : new Set(items.map((i) => i.variantId)));
    },
    [items],
  );

  const allSelected = items.length > 0 && selectedIds.size === items.length;

  return { selectedIds, allSelected, toggleSelect, toggleSelectAll };
}
