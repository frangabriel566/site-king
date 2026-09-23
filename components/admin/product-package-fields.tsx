"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectOnFocus } from "@/lib/utils";
import {
  MIN_HEIGHT_CM,
  MIN_LENGTH_CM,
  MIN_WEIGHT_KG,
  MIN_WIDTH_CM,
} from "@/lib/shipping/limits";

export type PackageDraft = {
  weightGrams: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
};

/**
 * What the parcel weighs and measures — the numbers the Melhor Envio
 * quote is built from.
 *
 * Deliberately out in the open rather than inside the collapsed
 * "configurações avançadas" panel: a product without these cannot be
 * quoted, so it cannot be bought. That makes it a publishing
 * requirement, not an optional refinement, and the publish gate rejects
 * it (see publishableProductSchema).
 *
 * Measurements are of the *packed* parcel, not the garment. A shirt
 * measured flat on a table is not what goes in the box, and quoting the
 * garment under-prices every order.
 */
export function ProductPackageFields({
  value,
  onChange,
  invalid,
}: {
  value: PackageDraft;
  onChange: (patch: Partial<PackageDraft>) => void;
  invalid?: boolean;
}) {
  const below = (raw: string, floor: number, divisor = 1) => {
    const parsed = Number.parseFloat(raw.replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0 && parsed / divisor < floor;
  };

  // The carriers' own floors. Under them the parcel is billed at the
  // floor anyway, so saying so up front stops the operator hunting for a
  // price difference they cannot explain later.
  const warnings = [
    below(value.weightGrams, MIN_WEIGHT_KG, 1000) &&
      `Abaixo de ${MIN_WEIGHT_KG * 1000}g o frete é cobrado como ${MIN_WEIGHT_KG * 1000}g.`,
    below(value.lengthCm, MIN_LENGTH_CM) &&
      `O comprimento mínimo dos Correios é ${MIN_LENGTH_CM}cm.`,
    below(value.widthCm, MIN_WIDTH_CM) &&
      `A largura mínima dos Correios é ${MIN_WIDTH_CM}cm.`,
    below(value.heightCm, MIN_HEIGHT_CM) &&
      `A altura mínima dos Correios é ${MIN_HEIGHT_CM}cm.`,
  ].filter(Boolean) as string[];

  const field = (
    id: keyof PackageDraft,
    label: string,
    suffix: string,
    placeholder: string,
  ) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`package-${id}`}>{label}</Label>
      <div className="relative">
        <Input
          id={`package-${id}`}
          value={value[id]}
          onChange={(event) => onChange({ [id]: event.target.value })}
          onFocus={selectOnFocus}
          inputMode="decimal"
          placeholder={placeholder}
          aria-invalid={invalid && !value[id] ? true : undefined}
          className="pr-10"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-muted">
          {suffix}
        </span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {field("weightGrams", "Peso", "g", "300")}
        {field("lengthCm", "Comprimento", "cm", "20")}
        {field("widthCm", "Largura", "cm", "15")}
        {field("heightCm", "Altura", "cm", "3")}
      </div>
      {warnings.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs text-[var(--warning)]">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
