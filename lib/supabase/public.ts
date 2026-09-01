import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Anon-key client that never touches request cookies. Used by fully
 * public reads (products, categories, banners, site_settings) so
 * those pages stay eligible for static generation + ISR — calling
 * `cookies()` (as lib/supabase/server.ts does, for session-aware
 * reads) forces a route into dynamic rendering even when nothing
 * user-specific is actually read.
 *
 * Safe to use anywhere: same anon key, same RLS, just no session.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
