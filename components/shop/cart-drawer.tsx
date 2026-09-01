"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/context";
import { formatCurrency } from "@/lib/format";

export function CartDrawer() {
  const { items, subtotal, isOpen, close, setQty, removeItem } = useCart();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent
        className="flex w-full flex-col gap-0 border-l border-line bg-bg p-0 text-fg sm:max-w-md"
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">Sacola</SheetTitle>
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <span className="text-label !text-fg">
            Sacola {items.length > 0 ? `(${items.length})` : ""}
          </span>
          <button type="button" onClick={close} aria-label="Fechar sacola">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm text-ink-muted">Sua sacola está vazia.</p>
            <Link href="/colecao" onClick={close} className="link-arrow">
              Ver coleção →
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto divide-y divide-line px-6">
              {items.map((item) => (
                <li key={item.variantId} className="flex gap-4 py-5">
                  <div className="relative size-20 shrink-0 overflow-hidden bg-[#111111]">
                    {item.image && (
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/produto/${item.slug}`}
                        onClick={close}
                        className="text-sm hover:text-gold"
                      >
                        {item.name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeItem(item.variantId)}
                        aria-label={`Remover ${item.name}`}
                        className="text-ink-muted hover:text-fg"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                    <p className="text-label !text-ink-muted">
                      {item.color} · {item.size}
                    </p>
                    <div className="mt-1 flex items-center justify-between">
                      <div className="flex items-center gap-3 border border-line px-2 py-1">
                        <button
                          type="button"
                          onClick={() => setQty(item.variantId, item.qty - 1)}
                          aria-label="Diminuir quantidade"
                        >
                          <Minus className="size-3" aria-hidden="true" />
                        </button>
                        <span className="w-4 text-center text-xs">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => setQty(item.variantId, item.qty + 1)}
                          aria-label="Aumentar quantidade"
                        >
                          <Plus className="size-3" aria-hidden="true" />
                        </button>
                      </div>
                      <span className="text-sm">
                        {formatCurrency(item.price * item.qty)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-line px-6 py-6">
              <div className="mb-4 flex items-center justify-between text-sm">
                <span className="text-label !text-fg">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <p className="mb-4 text-xs text-ink-muted">
                Frete e descontos calculados no checkout.
              </p>
              <Button asChild size="xl" className="w-full" onClick={close}>
                <Link href="/checkout">Finalizar compra</Link>
              </Button>
              <Link
                href="/sacola"
                onClick={close}
                className="mt-4 block text-center text-label !text-fg hover:!text-gold"
              >
                Ver sacola completa
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
