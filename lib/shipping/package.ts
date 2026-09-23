import "server-only";

import type { QuotePackageItem } from "./melhor-envio";
import {
  MIN_HEIGHT_CM,
  MIN_LENGTH_CM,
  MIN_WEIGHT_KG,
  MIN_WIDTH_CM,
} from "./limits";

export {
  MIN_LENGTH_CM,
  MIN_WIDTH_CM,
  MIN_HEIGHT_CM,
  MIN_WEIGHT_KG,
} from "./limits";

export type ProductPackageSpec = {
  id: string;
  name: string;
  weight_grams: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
};

export type PackageLine = {
  product: ProductPackageSpec;
  quantity: number;
  unitPrice: number;
};

export class MissingPackageSpecError extends Error {
  readonly productNames: string[];

  constructor(productNames: string[]) {
    super(`Sem peso/medidas cadastrados: ${productNames.join(", ")}.`);
    this.name = "MissingPackageSpecError";
    this.productNames = productNames;
  }
}

/** Every product in the parcel has to carry a spec. Quoting around a
 *  guessed weight produces a price the store then eats the difference
 *  on, so a missing one is an error the operator must fix, not a
 *  default to paper over. */
export function assertPackageSpecs(lines: PackageLine[]): void {
  const missing = lines
    .filter(
      (line) =>
        !line.product.weight_grams ||
        !line.product.length_cm ||
        !line.product.width_cm ||
        !line.product.height_cm,
    )
    .map((line) => line.product.name);

  if (missing.length > 0) throw new MissingPackageSpecError([...new Set(missing)]);
}

/**
 * One entry per product line, in the units Melhor Envio expects
 * (centimetres, kilograms). Quantities stay as quantities rather than
 * being multiplied out: the carriers' own cubing rules decide how the
 * box is made up, and they do it better than a naive sum would.
 */
export function toQuoteItems(lines: PackageLine[]): QuotePackageItem[] {
  return lines.map((line) => ({
    id: line.product.id,
    width: Math.max(Number(line.product.width_cm ?? 0), MIN_WIDTH_CM),
    height: Math.max(Number(line.product.height_cm ?? 0), MIN_HEIGHT_CM),
    length: Math.max(Number(line.product.length_cm ?? 0), MIN_LENGTH_CM),
    weight: Math.max((line.product.weight_grams ?? 0) / 1000, MIN_WEIGHT_KG),
    insurance_value: round2(line.unitPrice * line.quantity),
    quantity: line.quantity,
  }));
}

/**
 * The single box a label is bought for.
 *
 * A quote may be spread over several product lines, but a label is one
 * physical parcel, so the lines have to be consolidated: weights add up,
 * the footprint is the widest and longest of anything going in, and the
 * heights stack. That is the honest approximation of items laid flat in
 * one box — it over-estimates a little for small items, which errs
 * towards the store paying slightly more rather than the carrier
 * refusing the parcel at the counter.
 */
export function toSingleVolume(lines: PackageLine[]): {
  height: number;
  width: number;
  length: number;
  weight: number;
} {
  let weight = 0;
  let height = 0;
  let width = MIN_WIDTH_CM;
  let length = MIN_LENGTH_CM;

  for (const line of lines) {
    weight += ((line.product.weight_grams ?? 0) / 1000) * line.quantity;
    height += Number(line.product.height_cm ?? 0) * line.quantity;
    width = Math.max(width, Number(line.product.width_cm ?? 0));
    length = Math.max(length, Number(line.product.length_cm ?? 0));
  }

  return {
    weight: round2(Math.max(weight, MIN_WEIGHT_KG)),
    height: round2(Math.max(height, MIN_HEIGHT_CM)),
    width: round2(width),
    length: round2(length),
  };
}

export function insuranceValue(lines: PackageLine[]): number {
  return round2(
    lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Melhor Envio wants eight digits, no dash. */
export function normalizeCep(cep: string): string {
  return cep.replace(/\D/g, "");
}

export function isValidCep(cep: string): boolean {
  return /^\d{8}$/.test(normalizeCep(cep));
}
