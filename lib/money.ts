/** Money is stored as SQLite `real`; every value is rounded to cents
 * before it is written, so sums like 0.1 + 0.2 never reach the database. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
