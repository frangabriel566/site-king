import type { SizeGuide } from "@/lib/db/schema";

export type { SizeGuide };

export const SIZE_GUIDE_MAX_COLUMNS = 8;
export const SIZE_GUIDE_MAX_ROWS = 30;
export const SIZE_GUIDE_CELL_MAX = 40;
export const SIZE_GUIDE_NOTE_MAX = 200;

/**
 * Cleans a size chart as the admin editor submits it, or returns null
 * when there is nothing left to show. Shared by the editor (live preview)
 * and the server action (what gets stored), so both agree on what an
 * "empty" table is:
 *   - cells trimmed and cut to SIZE_GUIDE_CELL_MAX;
 *   - a row with every cell blank is dropped;
 *   - a column with a blank title and no value in any row is dropped;
 *   - every row padded/cut to the number of columns.
 * A table with no row left is no table at all — the product page then
 * shows no "Guia de medidas" link instead of an empty chart.
 */
export function normalizeSizeGuide(input: unknown): SizeGuide | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as { columns?: unknown; rows?: unknown; note?: unknown };
  if (!Array.isArray(raw.columns) || !Array.isArray(raw.rows)) return null;

  const cell = (value: unknown) => String(value ?? "").trim().slice(0, SIZE_GUIDE_CELL_MAX);
  let columns = raw.columns.slice(0, SIZE_GUIDE_MAX_COLUMNS).map(cell);
  let rows = raw.rows
    .filter(Array.isArray)
    .map((row: unknown[]) => columns.map((_, i) => cell(row[i])))
    .filter((row) => row.some(Boolean))
    .slice(0, SIZE_GUIDE_MAX_ROWS);

  const keep = columns.map((title, i) => Boolean(title) || rows.some((row) => Boolean(row[i])));
  columns = columns.filter((_, i) => keep[i]);
  rows = rows.map((row) => row.filter((_, i) => keep[i]));

  if (columns.length === 0 || rows.length === 0) return null;
  const note = typeof raw.note === "string" ? raw.note.trim().slice(0, SIZE_GUIDE_NOTE_MAX) : "";
  return { columns, rows, note: note || null };
}

/** "P\t88–96\t72–80" lines, as copied from a spreadsheet (tabs) or typed
 * with semicolons. The first line is the header. */
export function parseSizeGuidePaste(text: string): SizeGuide | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(line.includes("\t") ? "\t" : ";"));
  if (lines.length < 2) return null;
  const [columns, ...rows] = lines;
  return normalizeSizeGuide({ columns, rows });
}
