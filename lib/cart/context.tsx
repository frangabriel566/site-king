"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CART_STORAGE_KEY } from "@/lib/constants";
import { useCloseOnNavigation } from "@/lib/hooks/use-close-on-navigation";
import type { CartItem } from "./types";

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  isHydrated: boolean;
  /** Goes up by one on every add — the header bumps the bag icon on it. */
  addedCount: number;
  addItem: (item: CartItem) => void;
  /** Swaps a line for another variant of the same product (the bag's size
   * picker), keeping its place; merges into an existing line for that
   * variant if there is one. */
  changeVariant: (fromVariantId: string, to: Pick<CartItem, "variantId" | "color" | "size">) => void;
  removeItem: (variantId: string) => void;
  setQty: (variantId: string, qty: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function readStoredCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  useEffect(() => {
    setItems(readStoredCart());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items, isHydrated]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === item.variantId);
      if (existing) {
        return prev.map((i) =>
          i.variantId === item.variantId
            ? { ...i, qty: i.qty + item.qty }
            : i,
        );
      }
      return [...prev, item];
    });
    setAddedCount((n) => n + 1);
    // Adding no longer opens the drawer. Interrupting the shopper with a
    // full-screen bag after every single add is what turned a browse into
    // a one-item trip; whoever wants the bag taps the bag. The caller
    // confirms the add itself (a toast on the product page), so nothing
    // happens silently.
  }, []);

  const changeVariant = useCallback(
    (fromVariantId: string, to: Pick<CartItem, "variantId" | "color" | "size">) => {
      setItems((prev) => {
        const from = prev.find((i) => i.variantId === fromVariantId);
        if (!from || fromVariantId === to.variantId) return prev;
        const existing = prev.find((i) => i.variantId === to.variantId);
        if (existing) {
          return prev
            .filter((i) => i.variantId !== fromVariantId)
            .map((i) => (i.variantId === to.variantId ? { ...i, qty: i.qty + from.qty } : i));
        }
        return prev.map((i) => (i.variantId === fromVariantId ? { ...i, ...to } : i));
      });
    },
    [],
  );

  const removeItem = useCallback((variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }, []);

  const setQty = useCallback((variantId: string, qty: number) => {
    setItems((prev) => {
      if (qty <= 0) return prev.filter((i) => i.variantId !== variantId);
      return prev.map((i) => (i.variantId === variantId ? { ...i, qty } : i));
    });
  }, []);

  // The bag lives up here in the layout, so it outlives every page under
  // it. Without this it rode along through a route change still open,
  // still holding the body lock, and left the next page unusable.
  useCloseOnNavigation(useCallback(() => setIsOpen(false), []));

  const clear = useCallback(() => setItems([]), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const count = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items]);
  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.price * i.qty, 0),
    [items],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count,
      subtotal,
      isOpen,
      isHydrated,
      addedCount,
      addItem,
      changeVariant,
      removeItem,
      setQty,
      clear,
      open,
      close,
      toggle,
    }),
    [items, count, subtotal, isOpen, isHydrated, addedCount, addItem, changeVariant, removeItem, setQty, clear, open, close, toggle],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
