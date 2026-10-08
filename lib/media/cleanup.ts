import "server-only";
import { getDb } from "@/lib/db";
import { deleteObject, listObjects, measureObject, type ListedObject } from "@/lib/storage";
import { isImageKey, storedKeysFor, uploadKeyFor } from "@/lib/image-url";
import { allUploadKeysInUse, uploadKeysInUse } from "./images";

/**
 * Admin → Faxina de imagens: files in KV that no row points at — photos of
 * products deleted before releaseImages existed, replaced banners, uploads
 * from forms that were never saved.
 *
 * Two steps, always: findOrphanUploads only reads and reports; nothing is
 * deleted until the admin confirms, and then deleteOrphanUploads checks
 * each upload against the database again right before deleting it.
 */

/** A form left open can hold an upload nothing points at yet. */
export const MIN_ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

/** Old files carry no size; measuring one is a read of the whole file, so
 * one analysis measures at most this many. */
export const MEASURE_LIMIT = 60;

/** Uploads per delete call — each is 2 to 4 KV deletes, well under the
 * 1 000 operations a request may make. */
export const DELETE_BATCH = 25;

// 20 pages of 1 000: far beyond this store, and a bound on one request.
const MAX_LIST_PAGES = 20;

export type OrphanUpload = {
  /** The upload key (what a row would point at). */
  key: string;
  folder: string;
  /** Every file stored for it: photo, thumbnail, logo icons. */
  files: string[];
  /** Null when some file could not be measured in this analysis. */
  bytes: number | null;
  /** Null for files from before upload dates were recorded. */
  uploadedAt: string | null;
};

export type OrphanReport = {
  orphans: OrphanUpload[];
  /** Sum of the sizes that are known. */
  totalBytes: number;
  /** Orphans whose size is not (fully) known. */
  unmeasured: number;
  /** Unused, but uploaded less than 24 hours ago — left alone. */
  recent: number;
  /** Uploads in KV that some row uses. */
  inUse: number;
  /** Keys in KV that are not uploads of this site — never touched. */
  foreign: number;
};

async function listAll(): Promise<ListedObject[]> {
  const all: ListedObject[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const result = await listObjects({ cursor });
    all.push(...result.objects);
    cursor = result.cursor;
    if (!cursor) break;
  }
  return all;
}

export async function findOrphanUploads(now = Date.now()): Promise<OrphanReport> {
  const objects = await listAll();
  // Read after listing: anything saved meanwhile is seen as in use.
  const used = await allUploadKeysInUse(getDb());

  const groups = new Map<string, ListedObject[]>();
  let foreign = 0;
  for (const object of objects) {
    if (!isImageKey(object.key)) {
      foreign += 1;
      continue;
    }
    const key = uploadKeyFor(object.key);
    groups.set(key, [...(groups.get(key) ?? []), object]);
  }

  const orphans: OrphanUpload[] = [];
  let recent = 0;
  let inUse = 0;
  for (const [key, files] of groups) {
    if (used.has(key)) {
      inUse += 1;
      continue;
    }
    const dates = files.flatMap((file) => (file.metadata?.uploadedAt ? [file.metadata.uploadedAt] : []));
    const uploadedAt = dates.sort().at(-1) ?? null;
    if (uploadedAt && now - Date.parse(uploadedAt) < MIN_ORPHAN_AGE_MS) {
      recent += 1;
      continue;
    }
    orphans.push({
      key,
      folder: key.split("/")[0],
      files: files.map((file) => file.key),
      bytes: 0,
      uploadedAt,
    });
  }

  // Sizes: recorded since this cleanup existed; older files are measured,
  // up to MEASURE_LIMIT reads per analysis.
  let measured = 0;
  for (const orphan of orphans) {
    const group = groups.get(orphan.key)!;
    let bytes: number | null = 0;
    for (const file of group) {
      let size = file.metadata?.size ?? null;
      if (size === null && measured < MEASURE_LIMIT) {
        measured += 1;
        size = await measureObject(file.key);
      }
      if (size === null) {
        bytes = null;
        break;
      }
      bytes += size;
    }
    orphan.bytes = bytes;
  }

  orphans.sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0));
  return {
    orphans,
    totalBytes: orphans.reduce((sum, orphan) => sum + (orphan.bytes ?? 0), 0),
    unmeasured: orphans.filter((orphan) => orphan.bytes === null).length,
    recent,
    inUse,
    foreign,
  };
}

export type DeleteOrphansResult = {
  deleted: number;
  /** Started being used since the analysis — left alone. */
  nowInUse: number;
  /** Set when KV refused a delete (the Free plan allows 1 000 a day);
   * the rest of the batch was not attempted. */
  error: string | null;
};

/**
 * Deletes the files of these uploads (at most DELETE_BATCH), each one
 * checked against the database again first. Keys that are not uploads of
 * this site are ignored.
 */
export async function deleteOrphanUploads(keys: string[]): Promise<DeleteOrphansResult> {
  const candidates = Array.from(
    new Set(keys.filter((key) => typeof key === "string" && isImageKey(key)).map(uploadKeyFor)),
  ).slice(0, DELETE_BATCH);
  if (candidates.length === 0) return { deleted: 0, nowInUse: 0, error: null };

  const used = await uploadKeysInUse(getDb(), candidates);
  const nowInUse = candidates.filter((key) => used.has(key)).length;
  let deleted = 0;
  for (const key of candidates) {
    if (used.has(key)) continue;
    try {
      for (const file of storedKeysFor(key)) await deleteObject(file);
      deleted += 1;
    } catch (error) {
      console.error(`[media] faxina: falha ao apagar ${key} do KV`, error);
      return {
        deleted,
        nowInUse,
        error:
          "O KV recusou a exclusão. Se foram muitas hoje, pode ser o limite diário do plano gratuito (1.000 exclusões); tente de novo amanhã.",
      };
    }
  }
  return { deleted, nowInUse, error: null };
}
