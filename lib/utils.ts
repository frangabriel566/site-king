import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { FocusEvent } from "react"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Selects the field's full text on focus so typing a new number always
 * replaces it — without this, a plain number input inserts at the cursor,
 * so retyping over a stale value silently produces garbage (e.g. typing
 * "8" into a field still showing "10" can yield "108" or "1080", not 8). */
export function selectOnFocus(e: FocusEvent<HTMLInputElement>) {
  e.target.select()
}
