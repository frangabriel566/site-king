"use client";

import { useState, type FormEvent } from "react";
import { Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCep } from "@/lib/format";
import { lookupCepAction } from "@/lib/actions/cep";

type Estimate = { city: string; state: string; days: string };

/** Estimated delivery window by region, resolved from the CEP via the
 *  existing ViaCEP lookup. There's no real freight-cost engine anywhere
 *  in the app yet (checkout itself only looks up the address) — this is
 *  a display-only estimate, not the figure charged at checkout. */
export function ShippingEstimate() {
  const [cep, setCep] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEstimate(null);
    setLoading(true);
    const result = await lookupCepAction(cep);
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const days = result.state === "SP" ? "2 a 4 dias úteis" : "5 a 9 dias úteis";
    setEstimate({ city: result.city, state: result.state, days });
  }

  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-sm font-medium text-fg">
        <Truck className="size-4" aria-hidden="true" />
        Calcular frete e prazo
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={cep}
          onChange={(e) => setCep(formatCep(e.target.value))}
          placeholder="00000-000"
          inputMode="numeric"
          maxLength={9}
          aria-label="CEP"
          className="max-w-40"
        />
        <Button type="submit" variant="outline" disabled={loading || cep.length < 9}>
          {loading ? "Calculando…" : "Calcular"}
        </Button>
      </form>
      {error && <p className="mt-2 text-xs text-alert">{error}</p>}
      {estimate && (
        <p className="mt-2 text-sm text-fg">
          Entrega em <strong>{estimate.city}/{estimate.state}</strong>: {estimate.days}.{" "}
          <span className="text-muted-foreground">Valor final calculado no checkout.</span>
        </p>
      )}
    </div>
  );
}
