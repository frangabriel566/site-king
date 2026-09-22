"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useCart } from "@/lib/cart/context";
import { useBagSelection } from "@/lib/hooks/use-bag-selection";
import { formatCurrency, formatVariantLabel } from "@/lib/format";

export function CartDrawer() {
  const { items, subtotal, isOpen, close, setQty, removeItem } = useCart();
  const { selectedIds, allSelected, toggleSelect, toggleSelectAll } =
    useBagSelection(items);

  const removeSelected = () => {
    selectedIds.forEach((id) => removeItem(id));
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent
        className="flex w-full flex-col gap-0 border-l border-line bg-white p-0 text-fg sm:max-w-md"
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">Sacola</SheetTitle>
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <span className="flex items-center gap-2 text-sm font-semibold">
            Sacola
            {items.length > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-fg text-[11px] font-semibold text-white">
                {items.length}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="Fechar sacola"
            className="flex size-8 items-center justify-center rounded-full border border-line text-muted-foreground transition-colors hover:bg-surface hover:text-fg"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-surface">
              <ShoppingBag className="size-7 text-muted-foreground" aria-hidden="true" />
            </div>
            <div>
              <p className="text-base font-semibold text-fg">Sua sacola está vazia</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Explore a coleção e encontre a sua próxima peça.
              </p>
            </div>
            <Button asChild size="lg" className="mt-2" onClick={close}>
              <Link href="/colecao">Ver coleção</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-line px-6 py-3">
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                  aria-label="Selecionar tudo"
                />
                Selecionar tudo
              </label>
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={removeSelected}
                  className="flex items-center gap-1.5 text-xs font-medium text-alert hover:underline"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Remover ({selectedIds.size})
                </button>
              )}
            </div>
            <ul className="flex-1 overflow-y-auto divide-y divide-line px-6">
              {items.map((item) => (
                <li key={item.variantId} className="flex gap-3 py-5">
                  <Checkbox
                    checked={selectedIds.has(item.variantId)}
                    onCheckedChange={() => toggleSelect(item.variantId)}
                    aria-label={`Selecionar ${item.name}`}
                    className="mt-1 shrink-0"
                  />
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-md border border-line bg-surface">
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
                        className="text-sm font-semibold leading-tight hover:text-gold-text"
                      >
                        {item.name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeItem(item.variantId)}
                        aria-label={`Remover ${item.name}`}
                        className="flex size-7 shrink-0 items-center justify-center rounded-full border border-alert/30 text-alert transition-colors hover:border-alert hover:bg-alert/10"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
                    {formatVariantLabel(item.color, item.size) && (
                      <p className="text-xs text-muted-foreground">
                        {formatVariantLabel(item.color, item.size)}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center divide-x divide-line rounded-md border border-line">
                        <button
                          type="button"
                          onClick={() => setQty(item.variantId, item.qty - 1)}
                          aria-label="Diminuir quantidade"
                          className="flex size-7 items-center justify-center transition-colors hover:bg-surface"
                        >
                          <Minus className="size-3" aria-hidden="true" />
                        </button>
                        <span className="w-8 text-center text-xs font-medium">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => setQty(item.variantId, item.qty + 1)}
                          aria-label="Aumentar quantidade"
                          className="flex size-7 items-center justify-center transition-colors hover:bg-surface"
                        >
                          <Plus className="size-3" aria-hidden="true" />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-price">
                        {formatCurrency(item.price * item.qty)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-line px-6 py-6">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="text-xl font-bold text-price">{formatCurrency(subtotal)}</span>
              </div>
              <p className="mb-4 text-xs text-muted-foreground">
                Frete e descontos calculados no checkout.
              </p>
              <Button asChild size="xl" className="w-full" onClick={close}>
                <Link href="/checkout">Finalizar compra</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="mt-3 w-full" onClick={close}>
                <Link href="/sacola">Ver sacola completa</Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
