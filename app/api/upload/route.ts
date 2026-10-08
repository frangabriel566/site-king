import { NextResponse, type NextRequest } from "next/server";
import { AdminAuthError, requireAdmin } from "@/lib/auth/guards";
import { putObject } from "@/lib/storage";
import {
  UPLOAD_FOLDERS,
  imageUrlForKey,
  keyFromImageUrl,
  storeLogoIconUrls,
  thumbnailKey,
  type UploadFolder,
} from "@/lib/image-url";

/**
 * Admin photo upload. The browser has already resized and re-encoded the
 * photo (lib/client-upload.ts) and sends both sizes; this only checks
 * them and stores them under one fresh key.
 *
 * The store logo (`logo=1`) is the exception: a PNG, sent with its two
 * icons, which land next to it (lib/image-url.ts). PNG is accepted for
 * nothing else — that is what lets a PNG in brand/ mean "logo with icons".
 *
 * A Route Handler rather than a Server Action: an action's body limit and
 * its lack of upload progress were what broke phone-photo uploads before.
 */

// The client aims for ≤500 KB and ~100 KB; these leave room for its
// rounding without letting an unprocessed original through.
const MAX_FULL_BYTES = 600 * 1024;
const MAX_THUMB_BYTES = 250 * 1024;
// 512px and 48px squares (lib/client-upload.ts), PNG.
const MAX_ICON_BYTES = 400 * 1024;
const MAX_FAVICON_BYTES = 40 * 1024;

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

  const isLogo = form.get("logo") === "1";
  const icon = form.get("icon");
  const favicon = form.get("favicon");
  if (isLogo) {
    if (folder !== "brand" || full.type !== "image/png") {
      return fail("A logo é enviada como PNG.", 415);
    }
    if (!(icon instanceof File) || !(favicon instanceof File)) {
      return fail("Envie a logo com os ícones.", 400);
    }
    if (icon.type !== "image/png" || favicon.type !== "image/png") {
      return fail("Formato de ícone não aceito.", 415);
    }
    if (icon.size > MAX_ICON_BYTES || favicon.size > MAX_FAVICON_BYTES) {
      return fail("Ícone grande demais.", 413);
    }
  } else if (full.type === "image/png") {
    return fail("Formato de imagem não aceito.", 415);
  }

  const extension = EXTENSIONS[full.type];
  if (!extension || thumb.type !== full.type) {
    return fail("Formato de imagem não aceito.", 415);
  }
  if (full.size > MAX_FULL_BYTES || thumb.size > MAX_THUMB_BYTES) {
    return fail("Imagem grande demais depois de comprimida.", 413);
  }

  const files = [full, thumb, ...(isLogo ? [icon as File, favicon as File] : [])];
  const bytes = await Promise.all(files.map((file) => file.arrayBuffer()));
  if (
    bytes.some(
      (data, index) =>
        !looksLike(files[index].type, new Uint8Array(data, 0, Math.min(12, data.byteLength))),
    )
  ) {
    return fail("O arquivo não é uma imagem válida.", 415);
  }

  const key = `${folder}/${crypto.randomUUID()}.${extension}`;
  const [fullBytes, thumbBytes, iconBytes, faviconBytes] = bytes;
  const writes = [
    putObject(key, fullBytes, full.type),
    putObject(thumbnailKey(key), thumbBytes, thumb.type),
  ];
  const icons = isLogo ? storeLogoIconUrls(imageUrlForKey(key)) : null;
  if (icons) {
    writes.push(
      putObject(keyFromImageUrl(icons.icon)!, iconBytes, "image/png"),
      putObject(keyFromImageUrl(icons.favicon)!, faviconBytes, "image/png"),
    );
  }
  await Promise.all(writes);

  return NextResponse.json({ url: imageUrlForKey(key), key });
}
