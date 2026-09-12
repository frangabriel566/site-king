"use client";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";

export const MAX_SOURCE_FILE_BYTES = 10 * 1024 * 1024; // 10MB, checked before compression
const MAX_DIMENSION = 2000;
// The file stored here is the ceiling for every size the storefront serves:
// the product gallery asks the optimizer for around 1080-1200px at q90 and
// then zooms 1.8x on hover, so artifacts baked in at upload time are exactly
// what shows up magnified. Costs roughly a third more bytes per photo.
const WEBP_QUALITY = 0.92;

export type UploadFolder = "products" | "banners" | "brand";

export type CompressedImage = { blob: Blob; width: number; height: number };

/**
 * Resizes to at most 2000px on the longest side and re-encodes as WebP
 * entirely in the browser — this is what actually fixes the "Body
 * exceeded 1MB limit" error, not the server-side safety net.
 */
export async function compressImageToWebp(file: File): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Este navegador não suporta processar imagens no cliente.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Falha ao gerar a imagem."))),
      "image/webp",
      WEBP_QUALITY,
    );
  });

  return { blob, width, height };
}

/**
 * A `fetch` replacement backed by XMLHttpRequest so we get real upload
 * progress events (fetch has no upload-progress API) and a handle to
 * abort mid-flight. Only used to intercept the Supabase JS client's own
 * network call — it still builds the request (headers, multipart body),
 * we just execute it differently.
 */
function createProgressFetch(
  onProgress: (loaded: number, total: number) => void,
  xhrHandle: { current: XMLHttpRequest | null },
): typeof fetch {
  return (input, init = {}) =>
    new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrHandle.current = xhr;

      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init.method ?? "GET";
      xhr.open(method, url, true);

      new Headers(init.headers).forEach((value, key) => xhr.setRequestHeader(key, value));
      xhr.responseType = "text";

      if (xhr.upload) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) onProgress(event.loaded, event.total);
        };
      }

      xhr.onload = () => {
        const headers = new Headers();
        xhr
          .getAllResponseHeaders()
          .trim()
          .split(/[\r\n]+/)
          .filter(Boolean)
          .forEach((line) => {
            const idx = line.indexOf(":");
            if (idx === -1) return;
            headers.append(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
          });
        resolve(new Response(xhr.responseText, { status: xhr.status, statusText: xhr.statusText, headers }));
      };
      xhr.onerror = () => reject(new TypeError("Falha de rede no upload."));
      xhr.onabort = () => reject(new DOMException("Upload cancelado.", "AbortError"));

      xhr.send((init.body as XMLHttpRequestBodyInit | null) ?? null);
    });
}

export type UploadResult =
  | { ok: true; url: string; path: string; width: number; height: number; sizeBytes: number }
  | { ok: false; error: string; cancelled?: boolean };

/**
 * Compresses then uploads straight from the browser to Supabase Storage
 * — the file never touches our Next.js server, so the Server Action
 * body size limit is irrelevant to this path. RLS (media_admin_insert)
 * is what actually gates this to admins, using the caller's own
 * session — the same guarantee the old server-side upload had.
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

  let compressed: CompressedImage;
  try {
    compressed = await compressImageToWebp(file);
  } catch {
    return { ok: false, error: "Não foi possível processar essa imagem." };
  }

  const sessionClient = createClient();
  const {
    data: { session },
  } = await sessionClient.auth.getSession();
  if (!session) {
    return { ok: false, error: "Sessão expirada — atualize a página e entre novamente." };
  }

  const xhrHandle: { current: XMLHttpRequest | null } = { current: null };
  let cancelled = false;
  options.registerCancel?.(() => {
    cancelled = true;
    xhrHandle.current?.abort();
  });

  const progressFetch = createProgressFetch((loaded, total) => {
    options.onProgress?.(Math.round((loaded / total) * 100));
  }, xhrHandle);

  const uploadClient = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: progressFetch,
        headers: { Authorization: `Bearer ${session.access_token}` },
      },
    },
  );

  const path = `${folder}/${crypto.randomUUID()}.webp`;

  const { error } = await uploadClient.storage.from("media").upload(path, compressed.blob, {
    contentType: compressed.blob.type || "image/webp",
    upsert: false,
  });

  if (error) {
    if (cancelled) return { ok: false, error: "Upload cancelado.", cancelled: true };
    return { ok: false, error: error.message };
  }

  const { data } = uploadClient.storage.from("media").getPublicUrl(path);
  return {
    ok: true,
    url: data.publicUrl,
    path,
    width: compressed.width,
    height: compressed.height,
    sizeBytes: compressed.blob.size,
  };
}

/**
 * SHA-256 of the raw file the operator picked, before compression —
 * compression is deterministic for a given source, but hashing the
 * original avoids depending on that. Used to catch the same photo being
 * uploaded twice under two different admin fields (e.g. once as a
 * general product image, once again as a variant's color photo), which
 * Storage's random per-upload filename can't detect on its own since
 * every upload gets a fresh URL regardless of content.
 */
export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function pathFromPublicUrl(url: string): string | null {
  const marker = "/object/public/media/";
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return url.slice(index + marker.length);
}
