import "server-only";
import { getDb } from "@/lib/db";

/**
 * Applies migration 0018 (the full-screen banners) on the live database the
 * first time a banner is read or saved, so the new banners work right after
 * the deploy without anyone running `npm run db:migrate:remote` by hand.
 *
 * The statements are the ones in drizzle/migrations/0018_banner_designer.sql,
 * run in one D1 batch (all or nothing), and the migration is recorded in
 * wrangler's `d1_migrations` table so a later `db:migrate:remote` skips it
 * instead of failing on "duplicate column". Two requests racing each other
 * is fine: the loser's batch fails on the duplicate column and the column
 * check right after sees it is there.
 */

const MIGRATION_NAME = "0018_banner_designer.sql";

const STATEMENTS = [
  "ALTER TABLE `banners` ADD `kind` text DEFAULT 'editavel' NOT NULL",
  "ALTER TABLE `banners` ADD `mobile_image_url` text",
  "ALTER TABLE `banners` ADD `eyebrow_highlight` text",
  "ALTER TABLE `banners` ADD `subtitle` text",
  "ALTER TABLE `banners` ADD `whatsapp_label` text",
  "ALTER TABLE `banners` ADD `show_whatsapp` integer DEFAULT true NOT NULL",
  "ALTER TABLE `banners` ADD `badge` text",
  "ALTER TABLE `banners` ADD `style` text",
  "UPDATE `banners` SET `active` = 0",
];

let ready: Promise<void> | null = null;

async function hasColumns(db: D1Database): Promise<boolean> {
  const { results } = await db.prepare("PRAGMA table_info(`banners`)").all<{ name: string }>();
  return results.some((column) => column.name === "style");
}

async function apply(): Promise<void> {
  // The same D1 the app queries through Drizzle.
  const db = getDb().$client;
  if (await hasColumns(db)) return;

  const tracked = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'd1_migrations'")
    .first<{ name: string }>();
  const batch = STATEMENTS.map((sql) => db.prepare(sql));
  if (tracked) {
    batch.push(db.prepare("INSERT INTO d1_migrations (name) VALUES (?)").bind(MIGRATION_NAME));
  }
  try {
    await db.batch(batch);
    console.log("[ensureBannerColumns] migration 0018 applied");
  } catch (error) {
    if (!(await hasColumns(db))) throw error;
  }
}

export function ensureBannerColumns(): Promise<void> {
  ready ??= apply().catch((error) => {
    ready = null; // try again on the next request
    throw error;
  });
  return ready;
}
