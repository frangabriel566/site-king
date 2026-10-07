"use client";

import type { UploadFolder } from "@/lib/image-url";

export type { UploadFolder };

export const MAX_SOURCE_FILE_BYTES = 10 * 1024 * 1024; // 10MB, checked before compression

// The stored photo is the ceiling for every size the storefront shows — the
// gallery zooms it 1.8x on hover — but Workers KV and a phone on 4G both
// want it small. 1600px on the longest side, ≤500 KB: quality steps down
// until it fits, and only if even the lowest step is too big does the
// photo shrink further.
const MAX_DIMENSION = 1600;
const MAX_FULL_BYTES = 500 * 1024;
const QUALITY_STEPS = [0.9, 0.84, 0.78, 0.72, 0.66, 0.6];
const SHRINK_FACTOR = 0.85;
const MAX_SHRINKS = 4;

// What cards, rails and admin lists load (lib/image-loader.ts picks it for
// any rendered width up to this). Width, not longest side: product photos
// are portrait, and a 640px-wide slot needs 640 real pixels across.
const THUMBNAIL_WIDTH = 640;
const THUMBNAIL_QUALITY = 0.8;

export type CompressedImage = { blob: Blob; width: number; height: number };

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Falha ao gerar a imagem."))),
      type,
      quality,
    );
  });
}

function draw(source: ImageBitmap, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Este navegador não suporta processar imagens no cliente.");
  // Without this the browser picks the cheapest resampling it has, which on
  // a big downscale eats fine detail like fabric weave and stitching.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

/** WebP where the browser can encode it; older Safari silently hands back
 * PNG for that request, which cannot be compressed by quality — JPEG then. */
async function encodeSmallest(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  const webp = await encode(canvas, "image/webp", quality);
  if (webp.type === "image/webp") return webp;
  return encode(canvas, "image/jpeg", quality);
}

async function compressFull(bitmap: ImageBitmap): Promise<CompressedImage> {
  let scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));

  for (let shrink = 0; shrink <= MAX_SHRINKS; shrink++) {
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = draw(bitmap, width, height);
    for (const quality of QUALITY_STEPS) {
      const blob = await encodeSmallest(canvas, quality);
      if (blob.size <= MAX_FULL_BYTES) return { blob, width, height };
    }
    scale *= SHRINK_FACTOR;
  }
  throw new Error("Não foi possível reduzir a imagem para 500 KB.");
}

async function compressThumbnail(bitmap: ImageBitmap, type: string): Promise<CompressedImage> {
  const scale = Math.min(1, THUMBNAIL_WIDTH / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  // Same format as the full-size file: the server stores both under one key.
  const blob = await encode(draw(bitmap, width, height), type, THUMBNAIL_QUALITY);
  return { blob, width, height };
}

/**
 * Resizes and re-encodes entirely in the browser, into the two files the
 * storefront serves: the full photo and a 640px-wide thumbnail.
 */
export async function compressImage(
  file: File,
): Promise<{ full: CompressedImage; thumbnail: CompressedImage }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const full = await compressFull(bitmap);
    const thumbnail = await compressThumbnail(bitmap, full.blob.type);
    return { full, thumbnail };
  } finally {
    bitmap.close();
  }
}

export type UploadResult =
  | { ok: true; url: string; path: string; width: number; height: number; sizeBytes: number }
  | { ok: false; error: string; cancelled?: boolean };

/**
 * POSTs both files to /api/upload over XMLHttpRequest — fetch has no
 * upload-progress events, and the uploaders show a progress bar and a
 * cancel button.
 */
function send(
  body: FormData,
  onProgress: (percent: number) => void,
  xhrHandle: { current: XMLHttpRequest | null },
): Promise<{ status: number; json: { url?: string; key?: string; error?: string } }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrHandle.current = xhr;
    xhr.open("POST", "/api/upload", true);
    xhr.responseType = "text";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let json = {};
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        // Non-JSON error page; the status code is what matters then.
      }
      resolve({ status: xhr.status, json });
    };
    xhr.onerror = () => reject(new TypeError("Falha de rede no upload."));
    xhr.onabort = () => reject(new DOMException("Upload cancelado.", "AbortError"));
    xhr.send(body);
  });
}

/**
 * Compresses then uploads to /api/upload, which stores the photo in
 * Workers KV and returns its /img URL. The route itself checks that the
 * caller is an admin (lib/auth/guards.ts).
 */
export async function uploadImageToStorage(
  file: File,
  folder: UploadFolder,
  options: {
    onProgress?: (percent: number) => void;
    registerCancel?: (cancel: () => void) => void;
  } = {},
): Promise<UploadResult> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Envie apenas arquivos de imagem." };
  }
  if (file.size > MAX_SOURCE_FILE_BYTES) {
    return { ok: false, error: "Arquivo maior que 10MB. Escolha uma foto menor." };
  }

  let compressed: { full: CompressedImage; thumbnail: CompressedImage };
  try {
    compressed = await compressImage(file);
  } catch {
    return { ok: false, error: "Não foi possível processar essa imagem." };
  }

  const xhrHandle: { current: XMLHttpRequest | null } = { current: null };
  let cancelled = false;
  options.registerCancel?.(() => {
    cancelled = true;
    xhrHandle.current?.abort();
  });

  const body = new FormData();
  body.set("folder", folder);
  body.set("file", compressed.full.blob, "full");
  body.set("thumb", compressed.thumbnail.blob, "thumb");

  try {
    const { status, json } = await send(body, (p) => options.onProgress?.(p), xhrHandle);
    if (status < 200 || status >= 300 || !json.url || !json.key) {
      return { ok: false, error: json.error ?? "Não foi possível enviar a imagem." };
    }
    return {
      ok: true,
      url: json.url,
      path: json.key,
      width: compressed.full.width,
      height: compressed.full.height,
      sizeBytes: compressed.full.blob.size,
    };
  } catch (error) {
    if (cancelled) return { ok: false, error: "Upload cancelado.", cancelled: true };
    return { ok: false, error: error instanceof Error ? error.message : "Falha no upload." };
  }
}

/**
 * SHA-256 of the raw file the operator picked, before compression —
 * compression is deterministic for a given source, but hashing the
 * original avoids depending on that. Used to catch the same photo being
 * uploaded twice under two different admin fields (e.g. once as a
 * general product image, once again as a variant's color photo), which
 * the random per-upload key can't detect on its own since every upload
 * gets a fresh URL regardless of content.
 */
export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
