"use server";

import sharp from "sharp";
import { randomUUID } from "crypto";
import { requireAdmin } from "./require-admin";

export type UploadResult =
  | { url: string; width: number; height: number; sizeBytes: number }
  | { error: string };

const MAX_SIZE_BYTES = 15 * 1024 * 1024;

export async function uploadMediaAction(
  folder: "banners" | "products" | "brand",
  formData: FormData,
): Promise<UploadResult> {
  try {
    const { supabase } = await requireAdmin();

    const file = formData.get("file");
    if (!(file instanceof File)) return { error: "Arquivo inválido." };
    if (file.size > MAX_SIZE_BYTES) return { error: "Arquivo maior que 15MB." };
    if (!file.type.startsWith("image/")) {
      return { error: "Envie apenas arquivos de imagem." };
    }

    const arrayBuffer = await file.arrayBuffer();
    const image = sharp(Buffer.from(arrayBuffer)).rotate().resize({
      width: 2400,
      withoutEnlargement: true,
    });
    const { data: webpBuffer, info } = await image
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    const path = `${folder}/${randomUUID()}.webp`;
    const { error } = await supabase.storage
      .from("media")
      .upload(path, webpBuffer, { contentType: "image/webp", upsert: false });

    if (error) return { error: error.message };

    const { data } = supabase.storage.from("media").getPublicUrl(path);
    return {
      url: data.publicUrl,
      width: info.width,
      height: info.height,
      sizeBytes: info.size,
    };
  } catch {
    return { error: "Não foi possível enviar a imagem." };
  }
}

export async function deleteMediaAction(url: string): Promise<{ ok: boolean }> {
  try {
    const { supabase } = await requireAdmin();
    const marker = "/object/public/media/";
    const index = url.indexOf(marker);
    if (index === -1) return { ok: false };
    const path = url.slice(index + marker.length);
    const { error } = await supabase.storage.from("media").remove([path]);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
