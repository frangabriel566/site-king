"use client";

import { Input } from "@/components/ui/input";

/**
 * Money field that types the way a card machine does: digits fill in from
 * the right and the decimal separator is already there, so 3799 reads as
 * 37,99 without anybody pressing a comma.
 *
 * What the operator sees is pt-BR ("1.234,56"); what the form submits is
 * always a plain dot-decimal ("1234.56") through a hidden field, because
 * that is what the server's schema coerces. The two never mix.
 */
export function CurrencyInput({
  id,
  name,
  value,
  onValueChange,
  placeholder = "0,00",
  className = "",
  ...rest
}: {
  id?: string;
  /** Field name posted with the dot-decimal value. */
  name: string;
  /** Canonical dot-decimal, e.g. "37.99". Empty string means unset. */
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "name" | "id">) {
  const cents = value === "" ? null : Math.round(Number(value) * 100);
  const display =
    cents === null || Number.isNaN(cents)
      ? ""
      : (cents / 100).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted"
      >
        R$
      </span>
      <Input
        {...rest}
        id={id}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "");
          // Leading zeros would grow forever ("000037,99"), so the value is
          // rebuilt from the number rather than from the typed string.
          onValueChange(digits === "" ? "" : (Number(digits) / 100).toFixed(2));
        }}
        placeholder={placeholder}
        className={`pl-9 ${className}`}
      />
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
