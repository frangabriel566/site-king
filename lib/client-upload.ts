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

/** Feedback screenshots (WhatsApp prints) are tall and full of small text:
 * 2400px on the long side keeps a 1080x2400 print at full size, so it stays
 * readable full screen. Same byte cap as everything else. */
const MAX_DIMENSION_BY_FOLDER: Partial<Record<UploadFolder, number>> = { feedbacks: 2400 };

async function compressFull(bitmap: ImageBitmap, maxDimension = MAX_DIMENSION): Promise<CompressedImage> {
  let scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));

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
  maxDimension = MAX_DIMENSION,
): Promise<{ full: CompressedImage; thumbnail: CompressedImage }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const full = await compressFull(bitmap, maxDimension);
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
    compressed = await compressImage(file, MAX_DIMENSION_BY_FOLDER[folder] ?? MAX_DIMENSION);
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

// ------------------------------------------------------------------
// Store logo (Configurações)
// ------------------------------------------------------------------

/** The logo shows at most 48px tall (the header); 240px keeps it sharp on
 * a 3x phone screen. PNG, not WebP: lossless, so the edges of the letters
 * stay clean, and transparent. */
const LOGO_HEIGHT = 240;
const LOGO_MAX_WIDTH = 1200;
/** An SVG is drawn this tall before trimming, so the trim loses nothing. */
const SVG_DRAW_HEIGHT = 2 * LOGO_HEIGHT;
const LOGO_TYPES = new Set(["image/png", "image/webp", "image/svg+xml"]);
/** Icons sit on black, like every place the logo appears (header, footer,
 * menu, panel) — a logo made for a dark background stays legible. */
const ICON_BACKGROUND = "#000000";
const ICON_PADDING = 0.12;
const ICON_SIZE = 512;
const FAVICON_SIZE = 48;

export const LOGO_ACCEPT = "image/png,image/webp,image/svg+xml,.svg";

function isSvg(file: File): boolean {
  return file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
}

function svgLength(value: string | null): number {
  return value && /^\s*[\d.]+(px)?\s*$/.test(value) ? Number.parseFloat(value) : Number.NaN;
}

/** An SVG has no pixels of its own: its root gets a pixel size (keeping its
 * viewBox, so the drawing scales) and the browser draws it at that size.
 * Loaded as an image, its scripts never run. */
async function drawSvg(file: File): Promise<HTMLCanvasElement> {
  const doc = new DOMParser().parseFromString(await file.text(), "image/svg+xml");
  const svg = doc.documentElement;
  if (svg.nodeName.toLowerCase() !== "svg" || doc.getElementsByTagName("parsererror").length) {
    throw new Error("Este SVG não pôde ser lido.");
  }
  const box = (svg.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  let width = svgLength(svg.getAttribute("width"));
  let height = svgLength(svg.getAttribute("height"));
  if (!(width > 0 && height > 0) && box.length === 4 && box[2] > 0 && box[3] > 0) {
    [width, height] = [box[2], box[3]];
  }
  if (!(width > 0 && height > 0)) throw new Error("O SVG não informa o tamanho (viewBox).");
  if (box.length !== 4) svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const drawWidth = Math.round((width * SVG_DRAW_HEIGHT) / height);
  svg.setAttribute("width", String(drawWidth));
  svg.setAttribute("height", String(SVG_DRAW_HEIGHT));

  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }),
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = drawWidth;
    canvas.height = SVG_DRAW_HEIGHT;
    canvas.getContext("2d")?.drawImage(image, 0, 0, drawWidth, SVG_DRAW_HEIGHT);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The logo without the transparent margin around it — a file exported
 * with a wide empty border would otherwise show up tiny in the header. */
function trimTransparent(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) throw new Error("A imagem está toda transparente.");
  const trimmed = document.createElement("canvas");
  trimmed.width = right - left + 1;
  trimmed.height = bottom - top + 1;
  trimmed.getContext("2d")?.drawImage(canvas, -left, -top);
  return trimmed;
}

function scaled(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Este navegador não suporta processar imagens no cliente.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function squareIcon(logo: HTMLCanvasElement, size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Este navegador não suporta processar imagens no cliente.");
  ctx.fillStyle = ICON_BACKGROUND;
  ctx.fillRect(0, 0, size, size);
  const inner = size * (1 - 2 * ICON_PADDING);
  const scale = Math.min(inner / logo.width, inner / logo.height);
  const width = logo.width * scale;
  const height = logo.height * scale;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(logo, (size - width) / 2, (size - height) / 2, width, height);
  return canvas;
}

/** The four PNGs of the store logo: the logo (≤240px tall), its thumbnail
 * (the upload route stores one with every image), and the two icons. */
async function processLogo(file: File): Promise<{
  logo: CompressedImage;
  thumb: Blob;
  icon: Blob;
  favicon: Blob;
}> {
  let source: HTMLCanvasElement;
  if (isSvg(file)) {
    source = await drawSvg(file);
  } else {
    const bitmap = await createImageBitmap(file);
    try {
      source = scaled(bitmap, bitmap.width, bitmap.height);
    } finally {
      bitmap.close();
    }
  }
  const trimmed = trimTransparent(source);

  let height = Math.min(LOGO_HEIGHT, trimmed.height);
  let width = Math.round((trimmed.width * height) / trimmed.height);
  if (width > LOGO_MAX_WIDTH) {
    height = Math.max(1, Math.round((height * LOGO_MAX_WIDTH) / width));
    width = LOGO_MAX_WIDTH;
  }
  const logoCanvas = scaled(trimmed, width, height);
  const logo = await encode(logoCanvas, "image/png", 1);
  const thumb =
    width > THUMBNAIL_WIDTH
      ? await encode(
          scaled(trimmed, THUMBNAIL_WIDTH, Math.max(1, Math.round((height * THUMBNAIL_WIDTH) / width))),
          "image/png",
          1,
        )
      : logo;

  return {
    logo: { blob: logo, width, height },
    thumb,
    icon: await encode(squareIcon(trimmed, ICON_SIZE), "image/png", 1),
    favicon: await encode(squareIcon(trimmed, FAVICON_SIZE), "image/png", 1),
  };
}

/** The store logo: PNG with a transparent background, SVG or WebP in;
 * stored as PNG with its icons (lib/image-url.ts). */
export async function uploadLogoToStorage(
  file: File,
  options: {
    onProgress?: (percent: number) => void;
    registerCancel?: (cancel: () => void) => void;
  } = {},
): Promise<UploadResult> {
  if (!LOGO_TYPES.has(file.type) && !isSvg(file)) {
    return { ok: false, error: "Envie a logo em PNG (fundo transparente), SVG ou WebP." };
  }
  if (file.size > MAX_SOURCE_FILE_BYTES) {
    return { ok: false, error: "Arquivo maior que 10MB." };
  }

  let processed: Awaited<ReturnType<typeof processLogo>>;
  try {
    processed = await processLogo(file);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && !(error instanceof DOMException)
          ? error.message
          : "Não foi possível processar essa logo. Tente PNG.",
    };
  }

  const xhrHandle: { current: XMLHttpRequest | null } = { current: null };
  let cancelled = false;
  options.registerCancel?.(() => {
    cancelled = true;
    xhrHandle.current?.abort();
  });

  const body = new FormData();
  body.set("folder", "brand");
  body.set("logo", "1");
  body.set("file", processed.logo.blob, "logo.png");
  body.set("thumb", processed.thumb, "thumb.png");
  body.set("icon", processed.icon, "icon.png");
  body.set("favicon", processed.favicon, "favicon.png");

  try {
    const { status, json } = await send(body, (p) => options.onProgress?.(p), xhrHandle);
    if (status < 200 || status >= 300 || !json.url || !json.key) {
      return { ok: false, error: json.error ?? "Não foi possível enviar a logo." };
    }
    return {
      ok: true,
      url: json.url,
      path: json.key,
      width: processed.logo.width,
      height: processed.logo.height,
      sizeBytes: processed.logo.blob.size,
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
