import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * The D1 database for the current request.
 *
 * Bindings only exist inside a request (or in `next dev`, through
 * initOpenNextCloudflareForDev in next.config.ts), which is why nothing in
 * this app is prerendered at build time — see `dynamic` in app/layout.tsx.
 */
export function getDb() {
  return drizzle(getCloudflareContext().env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;
export { schema };
