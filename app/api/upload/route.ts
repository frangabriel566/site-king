import { NextResponse, type NextRequest } from "next/server";
import { AdminAuthError, requireAdmin } from "@/lib/auth/guards";
import { putObject } from "@/lib/storage";
import {
  UPLOAD_FOLDERS,
  imageUrlForKey,
  thumbnailKey,
  type UploadFolder,
} from "@/lib/image-url";

/**
 * Admin photo upload. The browser has already resized and re-encoded the
 * photo (lib/client-upload.ts) and sends both sizes; this only checks
 * them and stores them under one fresh key.
 *
 * A Route Handler rather than a Server Action: an action's body limit and
 * its lack of upload progress were what broke phone-photo uploads before.
 */

// The client aims for ≤500 KB and ~100 KB; these leave room for its
// rounding without letting an unprocessed original through.
const MAX_FULL_BYTES = 600 * 1024;
const MAX_THUMB_BYTES = 250 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** The first bytes have to agree with the declared type — the route serves
 * these back with that type, to every visitor. */
function looksLike(type: string, bytes: Uint8Array): boolean {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (type === "image/webp") return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes[0] === 0x89 && ascii(1, 4) === "PNG";
  return false;
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (cause) {
    if (cause instanceof AdminAuthError) {
      return fail(
        "Sessão expirada — atualize a página e entre novamente.",
        cause.code === "UNAUTHORIZED" ? 401 : 403,
      );
    }
    throw cause;
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Envio inválido.", 400);
  }

  const folder = form.get("folder");
  const full = form.get("file");
  const thumb = form.get("thumb");

  if (typeof folder !== "string" || !UPLOAD_FOLDERS.includes(folder as UploadFolder)) {
    return fail("Pasta inválida.", 400);
  }
  if (!(full instanceof File) || !(thumb instanceof File)) {
    return fail("Envie a imagem e a miniatura.", 400);
  }

  const extension = EXTENSIONS[full.type];
  if (!extension || thumb.type !== full.type) {
    return fail("Formato de imagem não aceito.", 415);
  }
  if (full.size > MAX_FULL_BYTES || thumb.size > MAX_THUMB_BYTES) {
    return fail("Imagem grande demais depois de comprimida.", 413);
  }

  const [fullBytes, thumbBytes] = await Promise.all([full.arrayBuffer(), thumb.arrayBuffer()]);
  if (
    !looksLike(full.type, new Uint8Array(fullBytes, 0, Math.min(12, fullBytes.byteLength))) ||
    !looksLike(thumb.type, new Uint8Array(thumbBytes, 0, Math.min(12, thumbBytes.byteLength)))
  ) {
    return fail("O arquivo não é uma imagem válida.", 415);
  }

  const key = `${folder}/${crypto.randomUUID()}.${extension}`;
  await Promise.all([
    putObject(key, fullBytes, full.type),
    putObject(thumbnailKey(key), thumbBytes, thumb.type),
  ]);

  return NextResponse.json({ url: imageUrlForKey(key), key });
}
