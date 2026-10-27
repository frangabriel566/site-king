"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Minus, Plus, ScanBarcode, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SafeImage } from "@/components/shop/safe-image";
import { CurrencyInput } from "@/components/admin/currency-input";
import { formatCurrency, formatVariantLabel } from "@/lib/format";
import { roundMoney } from "@/lib/money";
import { createStoreSaleAction, searchStoreProductsAction, updateStoreSaleAction } from "@/lib/actions/store-sales";
import { STORE_PAYMENT_LABEL, STORE_PAYMENT_METHODS, type StorePaymentMethod } from "@/lib/store-sales/payment-methods";
import type { EditableStoreSale, StoreCustomerOption, StoreProductResult } from "@/lib/data/store-sales";
import { CustomerPicker } from "./customer-picker";

type Line = {
  variantId: string;
  name: string;
  variantLabel: string | null;
  image: string | null;
  stock: number;
  qty: number;
  /** Dot-decimal, as CurrencyInput keeps it. */
  unitPrice: string;
  sitePrice: number;
};

const STATUS_NOTE: Record<StoreProductResult["status"], string | null> = {
  active: null,
  draft: "Rascunho",
  archived: "Fora do site",
};

/** The round amounts a customer usually pays a cash total with: R$ 85 → 90, 100, 200. */
function cashSuggestions(total: number): number[] {
  if (total <= 0) return [];
  const amounts = [10, 50, 100, 200].map((step) => Math.ceil(total / step) * step).filter((value) => value > total);
  return [...new Set(amounts)].slice(0, 3);
}

const NO_HELD: Record<string, number> = {};
const NO_LOCKED: EditableStoreSale["locked"] = [];

/**
 * "Nova baixa": the pieces sold at the counter. Nothing leaves stock until
 * "Dar baixa" is confirmed — then all of it at once, or none of it if a
 * piece ran out in the meantime (lib/store-sales/sales.ts).
 *
 * With `sale`, the same form edits that sale: it starts filled in, the
 * pieces the sale already holds count as available, and saving moves stock
 * only by the difference.
 */
export function StoreSaleForm({
  sale,
  backHref = "/admin/vendas-loja",
}: {
  sale?: EditableStoreSale;
  /** Where an edit goes back to: the history, on the period it showed. */
  backHref?: string;
}) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<StoreProductResult[]>([]);
  const [searched, setSearched] = useState("");
  const [lines, setLines] = useState<Line[]>(
    () => sale?.lines.map((line) => ({ ...line, unitPrice: line.unitPrice.toFixed(2) })) ?? [],
  );
  const [discount, setDiscount] = useState(sale && sale.discount > 0 ? sale.discount.toFixed(2) : "");
  const [payment, setPayment] = useState<StorePaymentMethod | null>(sale?.payment_method ?? null);
  /** Dinheiro: what the customer handed over. Dot-decimal; "" = not typed. */
  const [cash, setCash] = useState(sale?.cash_received != null ? sale.cash_received.toFixed(2) : "");
  const [customer, setCustomer] = useState<StoreCustomerOption | null>(sale?.customer ?? null);
  /** A customer deleted from the book left only the name on the sale. */
  const [keepFormerName, setKeepFormerName] = useState(Boolean(sale?.formerCustomerName));
  const [note, setNote] = useState(sale?.note ?? "");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const held = sale?.held ?? NO_HELD;
  const locked = sale?.locked ?? NO_LOCKED;

  /** What the sale can take of a piece: its stock plus what it already holds. */
  function limitOf(variant: StoreProductResult["variants"][number]): number {
    return variant.stock + (held[variant.id] ?? 0);
  }

  async function runSearch(value: string): Promise<StoreProductResult[]> {
    const id = ++requestId.current;
    const found = await searchStoreProductsAction(value);
    // An older, slower answer must not replace a newer one.
    if (id === requestId.current) {
      setResults(found);
      setSearched(value);
    }
    return found;
  }

  useEffect(() => {
    const value = term.trim();
    if (value.length < 2) {
      requestId.current++;
      setResults([]);
      setSearched("");
      return;
    }
    const timer = setTimeout(() => void runSearch(value), 250);
    return () => clearTimeout(timer);
  }, [term]);

  function inCart(variantId: string): number {
    return lines.filter((line) => line.variantId === variantId).reduce((sum, line) => sum + line.qty, 0);
  }

  function addVariant(product: StoreProductResult, variant: StoreProductResult["variants"][number]) {
    const existing = lines.find((line) => line.variantId === variant.id);
    const limit = limitOf(variant);
    if (inCart(variant.id) >= limit) {
      toast.error("Não há mais estoque dessa peça.");
      return;
    }
    if (existing) {
      setLines((current) =>
        current.map((line) => (line.variantId === variant.id ? { ...line, qty: line.qty + 1, stock: limit } : line)),
      );
    } else {
      setLines((current) => [
        ...current,
        {
          variantId: variant.id,
          name: product.name,
          variantLabel: formatVariantLabel(variant.color, variant.size),
          image: product.image,
          stock: limit,
          qty: 1,
          unitPrice: product.price.toFixed(2),
          sitePrice: product.price,
        },
      ]);
    }
  }

  /** A barcode reader types the SKU and presses Enter. */
  async function handleEnter() {
    const value = term.trim();
    if (value.length < 2) return;
    const found = searched === value ? results : await runSearch(value);
    for (const product of found) {
      const variant = product.variants.find((v) => v.sku?.toLowerCase() === value.toLowerCase());
      if (variant) {
        addVariant(product, variant);
        setTerm("");
        return;
      }
    }
    // A single product with a single piece in stock: the same shortcut.
    const inStock = found.flatMap((product) =>
      product.variants.filter((v) => limitOf(v) > 0).map((variant) => ({ product, variant })),
    );
    if (found.length === 1 && inStock.length === 1) {
      addVariant(inStock[0].product, inStock[0].variant);
      setTerm("");
    }
  }

  function setQty(variantId: string, qty: number) {
    setLines((current) =>
      current.map((line) =>
        line.variantId === variantId ? { ...line, qty: Math.max(1, Math.min(line.stock, Math.floor(qty) || 1)) } : line,
      ),
    );
  }

  const subtotal = roundMoney(
    lines.reduce((sum, line) => sum + line.qty * (Number(line.unitPrice) || 0), 0) +
      locked.reduce((sum, line) => sum + line.qty * line.unitPrice, 0),
  );
  const discountValue = roundMoney(Number(discount) || 0);
  const total = roundMoney(Math.max(0, subtotal - discountValue));
  const pieces = [...lines, ...locked].reduce((sum, line) => sum + line.qty, 0);
  const hasPieces = lines.length > 0 || locked.length > 0;
  const discountTooHigh = discountValue > subtotal;
  // Worked out from the total on every render, so a later discount or price
  // change moves the change with it.
  const cashReceived = payment === "dinheiro" && cash !== "" ? roundMoney(Number(cash) || 0) : null;
  const change = cashReceived === null ? null : roundMoney(cashReceived - total);
  const cashShort = change !== null && change < 0;
  const canSubmit = hasPieces && payment !== null && !discountTooHigh && !cashShort && !pending;

  // Editing: what saving does to the stock, piece by piece.
  const stockMoves = sale
    ? [...new Set([...Object.keys(held), ...lines.map((line) => line.variantId)])].flatMap((variantId) => {
        const delta = inCart(variantId) - (held[variantId] ?? 0);
        const line =
          lines.find((l) => l.variantId === variantId) ?? sale.lines.find((l) => l.variantId === variantId);
        if (delta === 0 || !line) return [];
        return [{ variantId, back: delta < 0, label: `${Math.abs(delta)}x ${line.name}${line.variantLabel ? ` — ${line.variantLabel}` : ""}` }];
      })
    : [];

  function reset() {
    setLines([]);
    setDiscount("");
    setPayment(null);
    setCash("");
    setCustomer(null);
    setNote("");
    setTerm("");
    setResults([]);
    setSearched("");
    searchRef.current?.focus();
  }

  function submit() {
    if (!payment) return;
    startTransition(async () => {
      const input = {
        items: lines.map((line) => ({
          variantId: line.variantId,
          qty: line.qty,
          unitPrice: Number(line.unitPrice) || 0,
        })),
        discount: discountValue,
        paymentMethod: payment,
        cashReceived,
        customerId: customer?.id ?? null,
        note,
      };
      const result = sale
        ? await updateStoreSaleAction({ ...input, sale_id: sale.id, keepCustomerName: keepFormerName })
        : await createStoreSaleAction(input);
      if (result.ok) {
        toast.success(result.message);
        setConfirming(false);
        if (sale) router.push(backHref);
        else reset();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className="rounded-lg border border-line bg-card p-4 md:p-6">
          <Label htmlFor="store-sale-search" className="text-label mb-3 block">
            Buscar peça
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <Input
              id="store-sale-search"
              ref={searchRef}
              autoFocus
              autoComplete="off"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleEnter();
                }
              }}
              placeholder="Nome do produto, marca ou SKU"
              className="pl-9"
            />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
            <ScanBarcode className="size-3.5" aria-hidden="true" />
            Com leitor de código de barras, leia o SKU: a peça entra direto na venda.
          </p>

          {searched && results.length === 0 && (
            <p className="mt-4 text-sm text-ink-muted">Nenhum produto encontrado para &ldquo;{searched}&rdquo;.</p>
          )}

          {results.length > 0 && (
            <ul className="mt-4 flex flex-col divide-y divide-line">
              {results.map((product) => (
                <li key={product.id} className="flex gap-3 py-3">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-field">
                    {product.image && (
                      <SafeImage src={product.image} alt="" fill sizes="56px" fallbackLabel="" className="object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {product.name}
                      {STATUS_NOTE[product.status] && (
                        <span className="ml-2 text-xs font-normal text-ink-muted">({STATUS_NOTE[product.status]})</span>
                      )}
                    </p>
                    <p className="text-xs text-ink-muted">{formatCurrency(product.price)}</p>
                    {product.variants.length === 0 ? (
                      <p className="mt-2 text-xs text-ink-muted">Produto sem variações cadastradas.</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {product.variants.map((variant) => {
                          const available = limitOf(variant) - inCart(variant.id);
                          const label = formatVariantLabel(variant.color, variant.size) ?? "Adicionar";
                          return (
                            <button
                              key={variant.id}
                              type="button"
                              onClick={() => addVariant(product, variant)}
                              disabled={available <= 0}
                              className="rounded-md border border-line-strong bg-field px-2.5 py-1.5 text-xs transition-colors duration-150 ease-out hover:border-[var(--accent)] hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {label}
                              <span className="ml-1.5 text-ink-muted">
                                {limitOf(variant) === 0 ? "sem estoque" : `${available} em estoque`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-line bg-card p-4 md:p-6">
          <h2 className="text-label mb-4">Peças da venda</h2>
          {!hasPieces ? (
            <p className="text-sm text-ink-muted">Busque uma peça acima e escolha a cor/tamanho para adicionar.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {lines.map((line) => {
                const price = Number(line.unitPrice) || 0;
                return (
                  <li key={line.variantId} className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap">
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-field">
                      {line.image && (
                        <SafeImage src={line.image} alt="" fill sizes="48px" fallbackLabel="" className="object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{line.name}</p>
                      <p className="text-xs text-ink-muted">
                        {line.variantLabel ? `${line.variantLabel} · ` : ""}
                        {/* Editing, the stock shown counts the pieces this sale holds. */}
                        {sale ? `até ${line.stock}` : `${line.stock} em estoque`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1" role="group" aria-label={`Quantidade de ${line.name}`}>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => setQty(line.variantId, line.qty - 1)}
                        disabled={line.qty <= 1}
                        aria-label="Diminuir"
                      >
                        <Minus aria-hidden="true" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        max={line.stock}
                        value={line.qty}
                        onChange={(event) => setQty(line.variantId, Number(event.target.value))}
                        className="h-7 w-14 text-center"
                        aria-label="Quantidade"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => setQty(line.variantId, line.qty + 1)}
                        disabled={line.qty >= line.stock}
                        aria-label="Aumentar"
                      >
                        <Plus aria-hidden="true" />
                      </Button>
                    </div>
                    <div className="w-32">
                      <CurrencyInput
                        name={`price-${line.variantId}`}
                        value={line.unitPrice}
                        onValueChange={(value) =>
                          setLines((current) =>
                            current.map((l) => (l.variantId === line.variantId ? { ...l, unitPrice: value } : l)),
                          )
                        }
                        aria-label={`Preço unitário de ${line.name}`}
                        className="h-8"
                      />
                      {price !== line.sitePrice && (
                        <p className="mt-0.5 text-[11px] text-ink-muted">site: {formatCurrency(line.sitePrice)}</p>
                      )}
                    </div>
                    <p className="w-24 text-right text-sm tabular-nums">{formatCurrency(line.qty * price)}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setLines((current) => current.filter((l) => l.variantId !== line.variantId))}
                      aria-label={`Remover ${line.name}`}
                      className="text-ink-muted hover:text-[var(--danger)]"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </li>
                );
              })}
              {locked.map((line) => (
                <li key={line.id} className="flex items-center gap-3 py-3 text-ink-muted">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-field">
                    <Lock className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">
                      {line.qty}x {line.name}
                    </p>
                    <p className="text-xs">
                      {line.variantLabel ? `${line.variantLabel} · ` : ""}
                      Saiu do catálogo: fica na venda como está.
                    </p>
                  </div>
                  <p className="w-24 text-right text-sm tabular-nums">{formatCurrency(line.qty * line.unitPrice)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
        <section className="rounded-lg border border-line bg-card p-4 md:p-6">
          <h2 className="text-label mb-4">Pagamento</h2>
          <div role="radiogroup" aria-label="Forma de pagamento" className="grid grid-cols-3 gap-2">
            {STORE_PAYMENT_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                role="radio"
                aria-checked={payment === method}
                onClick={() => setPayment(method)}
                className={`rounded-lg border px-2 py-2 text-sm transition-colors duration-150 ease-out ${
                  payment === method
                    ? "border-[var(--accent)] bg-[var(--accent-soft-hover)] font-medium text-fg"
                    : "border-line-strong text-ink-muted hover:border-[var(--accent)] hover:text-fg"
                }`}
              >
                {STORE_PAYMENT_LABEL[method]}
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <Label htmlFor="store-sale-discount">Desconto na venda (opcional)</Label>
            <CurrencyInput
              id="store-sale-discount"
              name="discount"
              value={discount}
              onValueChange={setDiscount}
            />
            {discountTooHigh && (
              <p role="alert" className="text-xs text-[var(--danger)]">
                O desconto não pode passar de {formatCurrency(subtotal)}.
              </p>
            )}
          </div>

          <dl className="mt-5 flex flex-col gap-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between text-ink-muted">
              <dt>
                {pieces} {pieces === 1 ? "peça" : "peças"}
              </dt>
              <dd className="tabular-nums">{formatCurrency(subtotal)}</dd>
            </div>
            {discountValue > 0 && !discountTooHigh && (
              <div className="flex justify-between text-ink-muted">
                <dt>Desconto</dt>
                <dd className="tabular-nums">-{formatCurrency(discountValue)}</dd>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatCurrency(total)}</dd>
            </div>
          </dl>

          {payment === "dinheiro" && (
            <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4">
              <Label htmlFor="store-sale-cash">Valor recebido (para o troco)</Label>
              <CurrencyInput id="store-sale-cash" name="cash_received" value={cash} onValueChange={setCash} />
              {total > 0 && (
                <div className="flex flex-wrap gap-2">
                  {[total, ...cashSuggestions(total)].map((amount, index) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setCash(amount.toFixed(2))}
                      aria-pressed={cashReceived === amount}
                      className={`rounded-md border px-2.5 py-1.5 text-xs tabular-nums transition-colors duration-150 ease-out ${
                        cashReceived === amount
                          ? "border-[var(--accent)] bg-[var(--accent-soft-hover)] text-fg"
                          : "border-line-strong bg-field hover:border-[var(--accent)] hover:text-fg"
                      }`}
                    >
                      {index === 0 ? "Valor exato" : formatCurrency(amount)}
                    </button>
                  ))}
                </div>
              )}
              <div aria-live="polite">
                {change !== null &&
                  (cashShort ? (
                    <p className="flex justify-between text-sm font-medium text-[var(--danger)]">
                      <span>Faltam</span>
                      <span className="tabular-nums">{formatCurrency(-change)}</span>
                    </p>
                  ) : (
                    <p className="flex items-baseline justify-between text-lg font-semibold">
                      <span>Troco</span>
                      <span className="tabular-nums">{change > 0 ? formatCurrency(change) : "Sem troco"}</span>
                    </p>
                  ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-line bg-card p-4 md:p-6">
          <h2 className="text-label mb-4">Cliente (opcional)</h2>
          {sale?.formerCustomerName && keepFormerName && !customer ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line-strong bg-field px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{sale.formerCustomerName}</p>
                <p className="text-xs text-ink-muted">Cadastro excluído</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setKeepFormerName(false)}
                aria-label="Tirar o cliente da venda"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <CustomerPicker value={customer} onChange={setCustomer} />
          )}
          <div className="mt-5 flex flex-col gap-2">
            <Label htmlFor="store-sale-note">Observação (opcional)</Label>
            <Textarea
              id="store-sale-note"
              value={note}
              maxLength={500}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ex: troca de tamanho, pagou metade no Pix"
            />
          </div>
        </section>

        <div className="flex flex-col gap-2">
          <Button size="lg" className="h-11" disabled={!canSubmit} onClick={() => setConfirming(true)}>
            {sale ? "Salvar alterações" : "Dar baixa"}
          </Button>
          {hasPieces && payment === null && (
            <p className="text-center text-xs text-ink-muted">Escolha a forma de pagamento.</p>
          )}
          {hasPieces && cashShort && (
            <p className="text-center text-xs text-ink-muted">O valor recebido não cobre o total.</p>
          )}
          <Link href={backHref} className="text-center text-xs text-ink-muted hover:text-fg">
            {sale ? "Cancelar edição" : "Ver o resumo das vendas"}
          </Link>
        </div>
      </aside>

      <AlertDialog open={confirming} onOpenChange={(open) => !pending && setConfirming(open)}>
        <AlertDialogContent className="border-line bg-card text-fg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {sale ? `Salvar as alterações da venda #${sale.sale_number}?` : "Dar baixa nesta venda?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {!sale
                ? `${pieces} ${pieces === 1 ? "peça sai" : "peças saem"} do estoque agora, também no site.`
                : stockMoves.length === 0
                  ? "O estoque não muda."
                  : "O estoque muda assim, também no site:"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {stockMoves.length > 0 && (
            <dl className="flex flex-col gap-2 rounded-lg border border-line bg-field p-3 text-sm">
              {[
                { back: true, title: "Volta ao estoque" },
                { back: false, title: "Sai do estoque" },
              ].map(({ back, title }) => {
                const moves = stockMoves.filter((move) => move.back === back);
                if (moves.length === 0) return null;
                return (
                  <div key={title}>
                    <dt className="text-xs font-medium text-ink-muted">{title}</dt>
                    {moves.map((move) => (
                      <dd key={move.variantId}>{move.label}</dd>
                    ))}
                  </div>
                );
              })}
            </dl>
          )}
          <ul className="flex flex-col gap-1 text-sm">
            {lines.map((line) => (
              <li key={line.variantId} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">
                  {line.qty}x {line.name}
                  {line.variantLabel ? ` — ${line.variantLabel}` : ""}
                </span>
                <span className="shrink-0 tabular-nums text-ink-muted">
                  {formatCurrency(line.qty * (Number(line.unitPrice) || 0))}
                </span>
              </li>
            ))}
            {locked.map((line) => (
              <li key={line.id} className="flex justify-between gap-3 text-ink-muted">
                <span className="min-w-0 truncate">
                  {line.qty}x {line.name}
                  {line.variantLabel ? ` — ${line.variantLabel}` : ""}
                </span>
                <span className="shrink-0 tabular-nums">{formatCurrency(line.qty * line.unitPrice)}</span>
              </li>
            ))}
          </ul>
          <dl className="flex flex-col gap-1 border-t border-line pt-3 text-sm">
            {discountValue > 0 && (
              <div className="flex justify-between text-ink-muted">
                <dt>Desconto</dt>
                <dd>-{formatCurrency(discountValue)}</dd>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <dt>Total · {payment ? STORE_PAYMENT_LABEL[payment] : ""}</dt>
              <dd>{formatCurrency(total)}</dd>
            </div>
            {cashReceived !== null && change !== null && (
              <>
                <div className="flex justify-between text-ink-muted">
                  <dt>Recebido</dt>
                  <dd>{formatCurrency(cashReceived)}</dd>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <dt>Troco</dt>
                  <dd>{change > 0 ? formatCurrency(change) : "Sem troco"}</dd>
                </div>
              </>
            )}
            {(customer || (keepFormerName && sale?.formerCustomerName)) && (
              <div className="flex justify-between text-ink-muted">
                <dt>Cliente</dt>
                <dd>{customer?.name ?? sale?.formerCustomerName}</dd>
              </div>
            )}
          </dl>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              // Stays open until the server answers, so "sem estoque de X"
              // is read while the sale is still on screen.
              onClick={(event) => {
                event.preventDefault();
                submit();
              }}
              disabled={pending}
            >
              {sale ? (pending ? "Salvando…" : "Salvar alterações") : pending ? "Dando baixa…" : "Confirmar baixa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
