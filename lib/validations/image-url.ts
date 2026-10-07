import { z } from "zod";
import { keyFromImageUrl } from "@/lib/image-url";

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * A photo URL as the admin forms submit it: one of our uploads, which are
 * relative (`/img/products/<uuid>.webp`, served by the app itself), or an
 * absolute http(s) URL (seed photos, a pasted link). `z.url()` alone
 * rejected every upload once photos stopped living on an external host.
 */
export function imageUrlSchema(message = "URL de imagem inválida") {
  return z
    .string()
    .trim()
    .refine((value) => keyFromImageUrl(value) !== null || isAbsoluteHttpUrl(value), message);
}
