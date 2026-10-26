"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MONTH_NAMES, type PeriodMode } from "@/lib/store-sales/period";

const MODES: { value: PeriodMode; label: string }[] = [
  { value: "dia", label: "Dia" },
  { value: "mes", label: "Mês" },
  { value: "ano", label: "Ano" },
];

/**
 * One row above everything it scopes: the cards, the chart, the ranking
 * and the list all read the same period from the URL. Each mode button
 * opens the current day, month or year; the arrows and pickers move from
 * there.
 */
export function PeriodFilter({
  mode,
  periodKey,
  label,
  prev,
  next,
  today,
  years,
}: {
  mode: PeriodMode;
  periodKey: string;
  label: string;
  prev: string;
  next: string | null;
  /** YYYY-MM-DD in the store's clock. */
  today: string;
  /** Oldest first. */
  years: number[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(nextMode: PeriodMode, data?: string) {
    const params = new URLSearchParams({ periodo: nextMode });
    if (data) params.set("data", data);
    startTransition(() => router.push(`/admin/vendas-loja?${params.toString()}`));
  }

  const year = periodKey.slice(0, 4);
  const month = periodKey.slice(5, 7);
  const currentYear = today.slice(0, 4);

  return (
    <div
      className={`flex flex-wrap items-center gap-3 transition-opacity duration-150 ${pending ? "opacity-60" : ""}`}
      aria-busy={pending}
    >
      <div role="group" aria-label="Agrupar por" className="flex rounded-lg border border-line-strong bg-card p-0.5">
        {MODES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => go(option.value)}
            aria-pressed={mode === option.value}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors duration-150 ease-out ${
              mode === option.value
                ? "bg-[var(--accent-soft-hover)] font-medium text-fg"
                : "text-ink-muted hover:text-fg"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" onClick={() => go(mode, prev)} aria-label="Período anterior">
          <ChevronLeft aria-hidden="true" />
        </Button>
        <p className="min-w-40 px-2 text-center text-sm font-medium first-letter:uppercase" aria-live="polite">
          {label}
        </p>
        <Button
          variant="outline"
          size="icon"
          onClick={() => next && go(mode, next)}
          disabled={!next}
          aria-label="Próximo período"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>

      {mode === "dia" && (
        <Input
          type="date"
          value={periodKey}
          max={today}
          aria-label="Escolher o dia"
          className="w-auto"
          onChange={(event) => event.target.value && go("dia", event.target.value)}
        />
      )}

      {mode === "mes" && (
        <div className="flex items-center gap-2">
          <Select value={month} onValueChange={(value) => go("mes", `${year}-${value}`)}>
            <SelectTrigger className="w-36 capitalize" aria-label="Mês">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, index) => {
                const value = String(index + 1).padStart(2, "0");
                return (
                  <SelectItem
                    key={value}
                    value={value}
                    // Months that haven't started yet have nothing to show.
                    disabled={`${year}-${value}` > today.slice(0, 7)}
                    className="capitalize"
                  >
                    {name}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <YearSelect
            years={years}
            value={year}
            onChange={(value) =>
              go("mes", `${value}-${value === currentYear && month > today.slice(5, 7) ? today.slice(5, 7) : month}`)
            }
          />
        </div>
      )}

      {mode === "ano" && <YearSelect years={years} value={year} onChange={(value) => go("ano", value)} />}
    </div>
  );
}

function YearSelect({
  years,
  value,
  onChange,
}: {
  years: number[];
  value: string;
  onChange: (value: string) => void;
}) {
  const options = years.map(String);
  if (!options.includes(value)) options.push(value);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-28" aria-label="Ano">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options
          .sort()
          .reverse()
          .map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
