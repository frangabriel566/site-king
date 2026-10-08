"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { releaseImages } from "@/lib/media/images";
import {
  deleteOrphanUploads,
  findOrphanUploads,
  type DeleteOrphansResult,
  type OrphanReport,
} from "@/lib/media/cleanup";

/**
 * Drops an upload the form no longer wants (replaced or removed before
 * saving, or a form abandoned) — through releaseImages, so a file some row
 * already points at stays.
 * Uploads themselves go through /api/upload (see lib/client-upload.ts).
 * URLs that are not ours (seed photos on picsum) are left alone.
 */
export async function deleteMediaAction(url: string): Promise<{ ok: boolean }> {
  try {
    await requireAdmin();
    const { released } = await releaseImages([url]);
    return { ok: released.length > 0 };
  } catch {
    return { ok: false };
  }
}

export type OrphanAnalysisResult =
  | { ok: true; report: OrphanReport }
  | { ok: false; message: string };

/** Admin → Faxina de imagens, step 1: only reads and reports. */
export async function analyzeOrphanImagesAction(): Promise<OrphanAnalysisResult> {
  await requireAdmin();
  try {
    return { ok: true, report: await findOrphanUploads() };
  } catch (error) {
    console.error("[media] faxina: análise falhou", error);
    return { ok: false, message: "Não foi possível analisar as imagens agora. Tente de novo." };
  }
}

/** Step 2, after the admin confirms: one batch of the uploads they saw. */
export async function deleteOrphanImagesAction(keys: string[]): Promise<DeleteOrphansResult> {
  await requireAdmin();
  if (!Array.isArray(keys)) return { deleted: 0, nowInUse: 0, error: "Lista inválida." };
  try {
    return await deleteOrphanUploads(keys);
  } catch (error) {
    console.error("[media] faxina: exclusão falhou", error);
    return { deleted: 0, nowInUse: 0, error: "Não foi possível apagar agora. Tente de novo." };
  }
}
