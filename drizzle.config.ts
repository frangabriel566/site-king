import { defineConfig } from "drizzle-kit";

// Only generates SQL migrations from the schema. Applying them is wrangler's
// job (`npm run db:migrate:local` / `db:migrate:remote`), which reads the same
// folder through `migrations_dir` in wrangler.jsonc.
export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/db/schema.ts",
  out: "./drizzle/migrations",
});
