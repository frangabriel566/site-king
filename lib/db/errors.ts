/** Every message in an error's `cause` chain — Drizzle wraps the D1 error
 * ("UNIQUE constraint failed: products.slug: SQLITE_CONSTRAINT") in its own. */
function messages(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    if (current instanceof Error) {
      parts.push(current.message);
      current = current.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return parts.join(" | ");
}

/** True for a UNIQUE violation, optionally on one `table.column`. */
export function isUniqueViolation(error: unknown, column?: string): boolean {
  const text = messages(error);
  return text.includes("UNIQUE constraint failed") && (!column || text.includes(column));
}

/** True for a CHECK violation, optionally on one named constraint. */
export function isCheckViolation(error: unknown, constraint?: string): boolean {
  const text = messages(error);
  return text.includes("CHECK constraint failed") && (!constraint || text.includes(constraint));
}

export function describeDbError(error: unknown): string {
  return messages(error);
}
