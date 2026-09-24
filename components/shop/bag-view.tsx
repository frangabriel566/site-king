"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Minus, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart/context";
import { useBagSelection } from "@/lib/hooks/use-bag-selection";
import { FreightCalculator } from "@/components/shop/freight-calculator";
import { WhatsAppBuyButton } from "@/components/shop/whatsapp-buy-button";
import { formatCurrency, formatVariantLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/shop/empty-state";

export function BagView({ whatsappEnabled }: { whatsappEnabled: boolean }) {
  const { items, subtotal, setQty, removeItem, isHydrated } = useCart();
  const { selectedIds, allSelected, toggleSelect, toggleSelectAll } =
    useBagSelection(items);

  const removeSelected = () => {
    selectedIds.forEach((id) => removeItem(id));
  };

  // Uma entrada por produto, não por linha da sacola: a mesma peça em
  // duas cores são duas linhas, mas uma linha de pacote pesando o dobro.
  const freightItems = useMemo(() => {
    const byProduct = new Map<string, number>();
    for (const item of items) {
      byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + item.qty);
    }
    return [...byProduct].map(([productId, quantity]) => ({ productId, quantity }));
  }, [items]);

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

  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="px-8 py-12 md:px-12">
      <Link
        href="/colecao"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Continuar comprando
      </Link>
      <h1 className="mb-10 text-2xl font-bold text-fg md:text-3xl">
        Sacola <span className="text-muted-foreground">({itemCount})</span>
      </h1>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px] lg:gap-12">
        <div>
          <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-line bg-white px-5 py-3 md:px-6">
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
          <ul className="divide-y divide-line rounded-b-lg border border-line bg-white">
            {items.map((item) => (
              <li key={item.variantId} className="flex gap-4 p-5 md:p-6">
                <Checkbox
                  checked={selectedIds.has(item.variantId)}
                  onCheckedChange={() => toggleSelect(item.variantId)}
                  aria-label={`Selecionar ${item.name}`}
                  className="mt-1 shrink-0"
                />
                {/* 80px on the narrowest phones: at 320px wide the photo
                    at 96px left the quantity stepper without the room it
                    needs and pushed it past the card. */}
                <div className="relative size-20 shrink-0 overflow-hidden rounded-md border border-line bg-surface sm:size-24 md:size-28">
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
              {/* `min-w-0` on both this column and the title block: a
                  flex item defaults to `min-width: auto`, which refuses to
                  shrink below its content and pushed the remove button and
                  the line total off the right edge of the card on a phone
                  — the stepper plus a five-digit total needs more room
                  than a 360px screen leaves once the photo is placed. */}
              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/produto/${item.slug}`}
                      className="text-sm font-semibold hover:text-gold-text"
                    >
                      {item.name}
                    </Link>
                    {formatVariantLabel(item.color, item.size) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatVariantLabel(item.color, item.size)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.variantId)}
                    aria-label={`Remover ${item.name}`}
                    className="relative flex size-8 shrink-0 touch-manipulation items-center justify-center rounded-full border border-alert/30 text-alert transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:border-alert hover:bg-alert/10"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                {/* Wraps rather than overflows: on the narrowest phones
                    the total drops under the stepper instead of being
                    clipped by the card. */}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <div className="flex shrink-0 items-center divide-x divide-line rounded-md border border-line">
                    <button
                      type="button"
                      onClick={() => setQty(item.variantId, item.qty - 1)}
                      aria-label="Diminuir quantidade"
                      className="relative flex size-8 touch-manipulation items-center justify-center transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-surface"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-9 text-center text-sm font-medium">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(item.variantId, item.qty + 1)}
                      aria-label="Aumentar quantidade"
                      className="relative flex size-8 touch-manipulation items-center justify-center transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-surface"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <span className="text-base font-bold text-price">
                    {formatCurrency(item.price * item.qty)}
                  </span>
                </div>
              </div>
            </li>
          ))}
          </ul>
        </div>

        <div className="h-fit rounded-lg border border-line bg-white p-6 lg:sticky lg:top-24">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Resumo do pedido
          </p>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{itemCount} {itemCount === 1 ? "item" : "itens"}</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
            <span className="text-sm font-semibold text-fg">Subtotal</span>
            <span className="text-xl font-bold text-price">{formatCurrency(subtotal)}</span>
          </div>
          {/* Cota as transportadoras de verdade para a sacola como está.
              O cliente não escolhe nada aqui — isso responde "quanto sai
              o frete pra mim?" antes do checkout pedir o endereço, que é
              onde a escolha acontece. */}
          <FreightCalculator
            items={freightItems}
            className="mt-5 border-t border-line pt-5"
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Cupom aplicado no checkout.
          </p>
          <Button asChild size="xl" className="mt-6 w-full">
            <Link href="/checkout">Finalizar compra</Link>
          </Button>
          {whatsappEnabled && (
            <div className="mt-3">
              {/* A sacola inteira, não a seleção das caixinhas: aquelas
                  marcações existem para remover itens em lote, e ninguém
                  espera que desmarcar uma peça também a tire do pedido. */}
              <WhatsAppBuyButton
                getItems={() =>
                  items.map((item) => ({ variantId: item.variantId, qty: item.qty }))
                }
              />
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Geramos um código e você combina frete e pagamento com a loja.
              </p>
            </div>
          )}
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Compra 100% segura
          </p>
        </div>
      </div>
    </div>
  );
}
