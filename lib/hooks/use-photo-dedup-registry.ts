"use client";

import { useRef } from "react";
import { hashFile } from "@/lib/client-upload";

type RegistryEntry = { slotId: string; label: string };

/**
 * Tracks which photo (by content hash, not URL — Storage gives every
 * upload a fresh random filename regardless of content) has been used in
 * which slot of the product form, so uploading the same file into two
 * different slots (e.g. the general gallery and a color's own photo) can
 * be flagged instead of silently producing a duplicate-looking gallery.
 * Lives for the lifetime of the form; not persisted, so it only catches
 * duplicates introduced in the current editing session — which is
 * exactly the scenario this exists for.
 */
export function usePhotoDedupRegistry() {
  const registry = useRef<Map<string, RegistryEntry>>(new Map());

  /**
   * Call before uploading. Returns the label of the OTHER slot already
   * using this exact file, or undefined if it's new — and registers it
   * under `slotId` either way, so re-uploading to replace the same slot's
   * own photo never warns against itself.
   */
  async function checkAndRegister(
    file: File,
    slotId: string,
    label: string,
  ): Promise<string | undefined> {
    const hash = await hashFile(file);
    const existing = registry.current.get(hash);
    registry.current.set(hash, { slotId, label });
    if (existing && existing.slotId !== slotId) return existing.label;
    return undefined;
  }

  /** Call when a slot's photo is removed, so its hash stops blocking reuse
   * elsewhere (e.g. a color deleted, or a general image taken down). */
  function releaseSlot(slotId: string) {
    for (const [hash, entry] of registry.current) {
      if (entry.slotId === slotId) registry.current.delete(hash);
    }
  }

  return { checkAndRegister, releaseSlot };
}
