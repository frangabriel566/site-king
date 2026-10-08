"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { deleteObject } from "@/lib/storage";
import { keyFromImageUrl, storedKeysFor } from "@/lib/image-url";

/**
 * Deletes an orphaned/replaced upload — the photo, its thumbnail and, for
 * the store logo, its icons (lib/image-url.ts).
 * Uploads themselves go through /api/upload (see lib/client-upload.ts).
 * URLs that are not ours (seed photos on picsum) are left alone.
 */
export async function deleteMediaAction(url: string): Promise<{ ok: boolean }> {
  try {
    await requireAdmin();
    const key = keyFromImageUrl(url);
    if (!key) return { ok: false };
    await Promise.all(storedKeysFor(key).map((stored) => deleteObject(stored)));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
