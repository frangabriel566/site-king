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
  const { addItem, open } = useCart();

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
      onClick={() => {
        addItem(item);
        open();
      }}
      className={className}
    >
      {label} →
    </button>
  );
}
