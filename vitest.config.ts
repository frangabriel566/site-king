import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * `npm test`. Node tests only — nothing here runs in or ships with the
 * Worker. The integration tests start a real local D1 (wrangler's
 * getPlatformProxy, in memory) and apply drizzle/migrations to it.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // Server modules import "server-only", which throws outside React's
      // server build; the tests call those modules directly.
      "server-only": path.resolve(__dirname, "tests/support/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
