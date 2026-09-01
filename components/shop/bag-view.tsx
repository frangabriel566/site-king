"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, X } from "lucide-react";
import { useCart } from "@/lib/cart/context";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shop/empty-state";

export function BagView() {
  const { items, subtotal, setQty, removeItem, isHydrated } = useCart();

  if (isHydrated && items.length === 0) {
    return (
      <div className="px-8 py-24 md:px-12">
        <EmptyState
          title="Sua sacola está vazia"
          description="Explore a coleção e encontre a sua próxima peça."
          actionLabel="Ver coleção"
          actionHref="/colecao"
        />
      </div>
    );
  }

  return (
    <div className="px-8 py-12 md:px-12">
      <h1 className="text-heading mb-10 text-4xl">Sacola</h1>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_360px]">
        <ul className="divide-y divide-line border-y border-line">
          {items.map((item) => (
            <li key={item.variantId} className="flex gap-5 py-6">
              <div className="relative size-28 shrink-0 overflow-hidden bg-[#111111]">
                {item.image && (
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="flex flex-1 flex-col justify-between">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/produto/${item.slug}`} className="text-sm hover:text-gold">
                      {item.name}
                    </Link>
                    <p className="text-label mt-1 !text-ink-muted">
                      {item.color} · {item.size}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.variantId)}
                    aria-label={`Remover ${item.name}`}
                    className="text-ink-muted hover:text-fg"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 border border-line px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => setQty(item.variantId, item.qty - 1)}
                      aria-label="Diminuir quantidade"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-5 text-center text-sm">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(item.variantId, item.qty + 1)}
                      aria-label="Aumentar quantidade"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <span className="text-sm">{formatCurrency(item.price * item.qty)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="h-fit border border-line p-6">
          <p className="text-label mb-4">Resumo</p>
          <div className="flex items-center justify-between text-sm">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Frete e cupom calculados no checkout.
          </p>
          <Button asChild size="xl" className="mt-6 w-full">
            <Link href="/checkout">Finalizar compra</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
