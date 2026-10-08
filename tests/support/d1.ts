import { readFileSync } from "node:fs";
import path from "node:path";
import { getPlatformProxy } from "wrangler";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db";

const ROOT = path.resolve(__dirname, "../..");

/**
 * A fresh, in-memory D1 — the same engine production runs on — with every
 * migration in drizzle/migrations applied in order. Nothing is written to
 * .wrangler/state, so the dev database is never touched.
 */
export async function createTestDb(): Promise<{ db: Db; d1: D1Database; dispose: () => Promise<void> }> {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: path.join(ROOT, "wrangler.jsonc"),
    persist: false,
  });
  const d1 = proxy.env.DB;

  const journal = JSON.parse(
    readFileSync(path.join(ROOT, "drizzle/migrations/meta/_journal.json"), "utf8"),
  ) as { entries: { tag: string }[] };
  for (const { tag } of journal.entries) {
    const sql = readFileSync(path.join(ROOT, "drizzle/migrations", `${tag}.sql`), "utf8");
    for (const chunk of sql.split("--> statement-breakpoint")) {
      const statement = chunk
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim();
      if (statement) await d1.prepare(statement).run();
    }
  }

  return { db: drizzle(d1, { schema }) as unknown as Db, d1, dispose: proxy.dispose };
}
