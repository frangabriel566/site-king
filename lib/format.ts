import { isColorlessVariant, isSimpleVariant } from "@/lib/constants";

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

// Installments, Pix price and free shipping are store settings now — see
// lib/shop-config.ts.

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// Combining diacritical marks (U+0300..U+036F), built from char codes to
// avoid embedding literal combining characters in source.
const DIACRITICS_PATTERN = new RegExp(
  "[\\u0300-\\u036f]",
  "g",
);

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** "Cor · Tamanho" for display — null for a "produto sem variações" item
 *  (stored under the sentinel color/size from lib/constants), since there's
 *  nothing meaningful to show the shopper for those, and the size alone for
 *  a product sold in one colourway, whose rows all carry the sentinel
 *  color. */
export function formatVariantLabel(
  color: string | null | undefined,
  size: string | null | undefined,
): string | null {
  if (isSimpleVariant(color ?? "", size ?? "")) return null;
  if (isColorlessVariant(color ?? "")) return size || null;
  if (!color) return size || null;
  if (!size) return color;
  return `${color} · ${size}`;
}

export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/** "Maria Silva" -> "Maria S." — first name plus initials, so a review
 *  credits its author without publishing their full legal name. */
export function formatReviewerName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts[0]} ${parts
    .slice(1)
    .map((p) => `${p.charAt(0).toUpperCase()}.`)
    .join(" ")}`;
}
