"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { deleteObject } from "@/lib/storage";
import { keyFromImageUrl, thumbnailKey } from "@/lib/image-url";

/**
 * Deletes an orphaned/replaced upload — both the photo and its thumbnail.
 * Uploads themselves go through /api/upload (see lib/client-upload.ts).
 * URLs that are not ours (seed photos on picsum) are left alone.
 */
export async function deleteMediaAction(url: string): Promise<{ ok: boolean }> {
  try {
    await requireAdmin();
    const key = keyFromImageUrl(url);
    if (!key) return { ok: false };
    await Promise.all([deleteObject(key), deleteObject(thumbnailKey(key))]);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
