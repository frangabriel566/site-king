import "server-only";
import { getDb } from "@/lib/db";

/**
 * Applies the banner migrations on the live database the first time a
 * banner is read or saved, so the banners work right after the deploy
 * without anyone running `npm run db:migrate:remote` by hand:
 *
 * - 0018 (full-screen banners): kind, texts, style…
 * - 0019 (more photos per banner): extra_images.
 *
 * The statements are the ones in drizzle/migrations/, each migration run
 * in one D1 batch (all or nothing) and recorded in wrangler's
 * `d1_migrations` table, so a later `db:migrate:remote` skips it instead
 * of failing on "duplicate column". Two requests racing each other is
 * fine: the loser's batch fails on the duplicate column and the column
 * check right after sees it is there.
 */

const MIGRATIONS: { name: string; column: string; statements: string[] }[] = [
  {
    name: "0018_banner_designer.sql",
    column: "style",
    statements: [
      "ALTER TABLE `banners` ADD `kind` text DEFAULT 'editavel' NOT NULL",
      "ALTER TABLE `banners` ADD `mobile_image_url` text",
      "ALTER TABLE `banners` ADD `eyebrow_highlight` text",
      "ALTER TABLE `banners` ADD `subtitle` text",
      "ALTER TABLE `banners` ADD `whatsapp_label` text",
      "ALTER TABLE `banners` ADD `show_whatsapp` integer DEFAULT true NOT NULL",
      "ALTER TABLE `banners` ADD `badge` text",
      "ALTER TABLE `banners` ADD `style` text",
      "UPDATE `banners` SET `active` = 0",
    ],
  },
  {
    name: "0019_banner_photos.sql",
    column: "extra_images",
    statements: ["ALTER TABLE `banners` ADD `extra_images` text"],
  },
];

let ready: Promise<void> | null = null;

async function bannerColumns(db: D1Database): Promise<Set<string>> {
  const { results } = await db.prepare("PRAGMA table_info(`banners`)").all<{ name: string }>();
  return new Set(results.map((column) => column.name));
}

async function apply(): Promise<void> {
  // The same D1 the app queries through Drizzle.
  const db = getDb().$client;
  const columns = await bannerColumns(db);
  const pending = MIGRATIONS.filter((migration) => !columns.has(migration.column));
  if (pending.length === 0) return;

  const tracked = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'd1_migrations'")
    .first<{ name: string }>();
  for (const migration of pending) {
    const batch = migration.statements.map((sql) => db.prepare(sql));
    if (tracked) {
      batch.push(
        db.prepare("INSERT INTO d1_migrations (name) VALUES (?)").bind(migration.name),
      );
    }
    try {
      await db.batch(batch);
      console.log(`[ensureBannerColumns] ${migration.name} applied`);
    } catch (error) {
      if (!(await bannerColumns(db)).has(migration.column)) throw error;
    }
  }
}

export function ensureBannerColumns(): Promise<void> {
  ready ??= apply().catch((error) => {
    ready = null; // try again on the next request
    throw error;
  });
  return ready;
}
