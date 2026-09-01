"use server";

import { requireAdmin } from "./require-admin";

/**
 * Uploads themselves go straight from the browser to Supabase Storage
 * (see lib/client-upload.ts) — a Server Action's body size limit made
 * file uploads through this file too easy to break on real phone
 * photos. This action is left only for deleting orphaned/replaced
 * objects, whose payload is just a URL.
 */
export async function deleteMediaAction(url: string): Promise<{ ok: boolean }> {
  try {
    const { supabase } = await requireAdmin();
    const marker = "/object/public/media/";
    const index = url.indexOf(marker);
    if (index === -1) return { ok: false };
    const path = url.slice(index + marker.length);
    const { error } = await supabase.storage.from("media").remove([path]);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
