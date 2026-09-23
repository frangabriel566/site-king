"use client";

import { useState, type FormEvent } from "react";
import { Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCep, formatCurrency } from "@/lib/format";

export type FreightQuote = {
  serviceId: number;
  name: string;
  company: string;
  companyPicture: string | null;
  price: number;
  deliveryDays: number;
};

export type FreightItem = { productId: string; quantity: number };

/**
 * Real Melhor Envio quotes for a set of items.
 *
 * Only ids and quantities go over the wire — every price, weight and
 * measurement the carrier is given is read from the database inside
 * /api/frete. Nothing here can talk the freight down.
 */
export function FreightCalculator({
  items,
  className = "",
}: {
  items: FreightItem[];
  className?: string;
}) {
  const [cep, setCep] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<FreightQuote[] | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setQuotes(null);

    if (items.length === 0) {
      setError("Adicione um item para calcular o frete.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/frete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cep, items }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error ?? "Não foi possível calcular o frete.");
        return;
      }
      setQuotes(data.quotes ?? []);
    } catch {
      setError("Não foi possível calcular o frete.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <p className="mb-2 flex items-center gap-2 text-sm font-medium text-fg">
        <Truck className="size-4" aria-hidden="true" />
        Calcular frete e prazo
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={cep}
          onChange={(event) => setCep(formatCep(event.target.value))}
          placeholder="00000-000"
          inputMode="numeric"
          maxLength={9}
          aria-label="CEP de entrega"
          className="max-w-40"
        />
        <Button
          type="submit"
          variant="outline"
          disabled={loading || cep.replace(/\D/g, "").length !== 8}
        >
          {loading ? "Calculando…" : "Calcular"}
        </Button>
      </form>

      {error && <p className="mt-2 text-xs text-alert">{error}</p>}

      {quotes && quotes.length > 0 && (
        <ul className="mt-3 flex flex-col divide-y divide-line border-t border-line">
          {quotes.map((quote) => (
            <li
              key={quote.serviceId}
              className="flex items-center justify-between gap-3 py-2.5 text-sm"
            >
              <span className="min-w-0">
                <span className="block truncate text-fg">
                  {quote.company} {quote.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  até {quote.deliveryDays} dia{quote.deliveryDays === 1 ? "" : "s"} úteis
                </span>
              </span>
              <span className="shrink-0 font-semibold text-price">
                {formatCurrency(quote.price)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {quotes && quotes.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Nenhuma transportadora atende esse CEP.
        </p>
      )}
    </div>
  );
}
