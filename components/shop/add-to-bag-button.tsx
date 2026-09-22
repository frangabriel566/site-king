"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart/context";
import type { CartItem } from "@/lib/cart/types";

export function AddToBagButton({
  item,
  fallbackHref,
  label = "Adicionar à sacola",
  className,
}: {
  item: CartItem | null;
  fallbackHref: string;
  label?: string;
  className?: string;
}) {
  const { addItem } = useCart();

  if (!item) {
    return (
      <Link href={fallbackHref} className={className}>
        Ver produto →
      </Link>
    );
  }

  return (
    <button
      type="button"
      // No `open()` here either — see the note in lib/cart/context.tsx.
      // (Nothing imports this component today, but leaving the old
      // behaviour in it would quietly reintroduce the interruption the
      // first time someone did.)
      onClick={() => addItem(item)}
      className={className}
    >
      {label} →
    </button>
  );
}
