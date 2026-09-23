"use client";

import { useState } from "react";
import { Loader2, Printer, Tag, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";

type Quote = {
  serviceId: number;
  name: string;
  company: string;
  price: number;
  deliveryDays: number;
};

type Issued = {
  melhorenvioOrderId: string;
  labelUrl: string | null;
  trackingCode: string | null;
};

/**
 * Buying a Melhor Envio label, in two deliberate halves.
 *
 * "Cotar" only reads: it asks what the carriers would charge to send
 * this order to the address already on it, and costs nothing. "Gerar
 * etiqueta" is the half that spends the account balance and cannot be
 * undone from here, so it is never the first click, never automatic,
 * and says the amount out loud before it runs.
 */
export function ShippingLabel({
  orderId,
  initial,
}: {
  orderId: string;
  initial: Issued | null;
}) {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [selected, setSelected] = useState<Quote | null>(null);
  const [document, setDocument] = useState("");
  const [issued, setIssued] = useState<Issued | null>(initial);
  const [busy, setBusy] = useState<"quote" | "purchase" | null>(null);

  async function call(body: Record<string, unknown>) {
    const response = await fetch("/api/etiqueta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, ...body }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error ?? "Falha na comunicação.");
    return data;
  }

  async function handleQuote() {
    setBusy("quote");
    try {
      const data = await call({ action: "quote" });
      const list = (data.quotes ?? []) as Quote[];
      setQuotes(list);
      setSelected(list[0] ?? null);
      if (list.length === 0) toast.error("Nenhuma transportadora atende esse endereço.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Erro ao cotar.");
    } finally {
      setBusy(null);
    }
  }

  async function handlePurchase() {
    if (!selected) return;
    const confirmed = window.confirm(
      `Comprar a etiqueta ${selected.company} ${selected.name} por ${formatCurrency(
        selected.price,
      )}?\n\nO valor sai do saldo da conta no Melhor Envio e não pode ser desfeito por aqui.`,
    );
    if (!confirmed) return;

    setBusy("purchase");
    try {
      const data = (await call({
        action: "purchase",
        serviceId: selected.serviceId,
        document: document.replace(/\D/g, ""),
      })) as Issued & { alreadyIssued?: boolean };
      setIssued(data);
      toast.success(
        data.alreadyIssued
          ? "Este pedido já tinha etiqueta — mostrando a existente."
          : "Etiqueta gerada.",
      );
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Erro ao gerar etiqueta.");
    } finally {
      setBusy(null);
    }
  }

  if (issued) {
    return (
      <div className="rounded-lg border border-line bg-card p-4">
        <p className="text-label mb-3">Etiqueta</p>
        <p className="text-sm text-ink-muted">
          Melhor Envio: <span className="font-mono">{issued.melhorenvioOrderId}</span>
        </p>
        {issued.trackingCode && (
          <p className="mt-1 text-sm text-ink-muted">
            Rastreio: <span className="font-mono">{issued.trackingCode}</span>
          </p>
        )}
        {issued.labelUrl ? (
          <Button asChild variant="outline" className="mt-4 w-full">
            <a href={issued.labelUrl} target="_blank" rel="noreferrer">
              <Printer className="size-4" /> Imprimir etiqueta
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        ) : (
          <p className="mt-4 text-sm text-[var(--warning)]">
            A etiqueta foi comprada, mas o PDF ainda não voltou. Conclua no
            painel do Melhor Envio.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <p className="text-label mb-3">Etiqueta</p>

      {!quotes && (
        <>
          <p className="mb-4 text-sm text-ink-muted">
            Cota o frete para o endereço deste pedido. Não cobra nada.
          </p>
          <Button onClick={handleQuote} disabled={busy !== null} className="w-full">
            {busy === "quote" ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Cotando…
              </>
            ) : (
              <>
                <Tag className="size-4" /> Cotar frete
              </>
            )}
          </Button>
        </>
      )}

      {quotes && quotes.length > 0 && (
        <>
          <div className="mb-4 flex flex-col gap-2">
            {quotes.map((quote) => (
              <label
                key={quote.serviceId}
                className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors ${
                  selected?.serviceId === quote.serviceId
                    ? "border-accent-solid bg-accent"
                    : "border-line hover:bg-muted"
                }`}
              >
                <input
                  type="radio"
                  name="service"
                  checked={selected?.serviceId === quote.serviceId}
                  onChange={() => setSelected(quote)}
                  className="accent-[var(--accent)]"
                />
                <span className="flex-1">
                  {quote.company} {quote.name}
                  <span className="block text-xs text-ink-muted">
                    até {quote.deliveryDays} dia{quote.deliveryDays === 1 ? "" : "s"} úteis
                  </span>
                </span>
                <span className="font-medium">{formatCurrency(quote.price)}</span>
              </label>
            ))}
          </div>

          {/* O checkout não pede CPF, e os Correios exigem o documento do
              destinatário na declaração de conteúdo. Até o checkout passar
              a capturá-lo, ele é digitado aqui. */}
          <div className="mb-4 flex flex-col gap-2">
            <Label htmlFor="recipient-document">CPF do destinatário</Label>
            <Input
              id="recipient-document"
              value={document}
              onChange={(event) => setDocument(event.target.value)}
              placeholder="000.000.000-00"
              inputMode="numeric"
              autoComplete="off"
            />
            <p className="text-xs text-ink-muted">
              Exigido pelos Correios. O checkout ainda não coleta esse dado.
            </p>
          </div>

          <Button
            onClick={handlePurchase}
            disabled={busy !== null || !selected}
            className="w-full"
          >
            {busy === "purchase" ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Gerando…
              </>
            ) : (
              <>
                <Tag className="size-4" /> Gerar etiqueta
                {selected ? ` — ${formatCurrency(selected.price)}` : ""}
              </>
            )}
          </Button>
          <p className="mt-2 text-xs text-ink-muted">
            Debita o saldo da conta no Melhor Envio.
          </p>
        </>
      )}
    </div>
  );
}
