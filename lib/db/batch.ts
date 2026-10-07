import { getTableColumns } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Db } from "./index";

/**
 * D1 has no interactive transactions (`BEGIN … COMMIT` across awaits).
 * What it has is `batch`: the statements run in order, as one transaction —
 * if any of them fails (a UNIQUE or CHECK violation, say), none of them
 * took effect. Every multi-statement write in this app goes through here.
 */
export async function runBatch(db: Db, statements: BatchItem<"sqlite">[]) {
  if (statements.length === 0) return [];
  const [first, ...rest] = statements;
  return db.batch([first, ...rest]);
}

// D1 rejects a statement with more than 100 bound parameters.
const D1_MAX_PARAMS = 100;

/**
 * A multi-row INSERT split into statements that each stay under D1's
 * parameter limit — e.g. 11 order items per statement (9 columns each).
 * Put the result in a `runBatch` so the rows still land all-or-nothing.
 */
export function insertChunks<T extends SQLiteTable>(
  db: Db,
  table: T,
  rows: T["$inferInsert"][],
): BatchItem<"sqlite">[] {
  if (rows.length === 0) return [];
  // Worst case: every column of every row is a bound parameter.
  const perRow = Object.keys(getTableColumns(table)).length;
  const size = Math.max(1, Math.floor(D1_MAX_PARAMS / perRow));
  const statements: BatchItem<"sqlite">[] = [];
  for (let i = 0; i < rows.length; i += size) {
    statements.push(db.insert(table).values(rows.slice(i, i + size)) as BatchItem<"sqlite">);
  }
  return statements;
}
