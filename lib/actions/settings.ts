"use server";

import { revalidatePath } from "next/cache";
import { siteSettingsSchema } from "@/lib/validations/settings";
import { requireAdmin } from "./require-admin";

export type ActionResult = { status: "idle" | "error" | "success"; message?: string };

export async function updateSiteSettingsAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = siteSettingsSchema.safeParse({
    store_name: formData.get("store_name"),
    logo_url: formData.get("logo_url"),
    whatsapp: formData.get("whatsapp"),
    email: formData.get("email"),
    instagram: formData.get("instagram"),
    tiktok: formData.get("tiktok"),
    youtube: formData.get("youtube"),
    shipping_note: formData.get("shipping_note"),
    free_shipping_note: formData.get("free_shipping_note"),
    announcement: formData.get("announcement"),
    announcement_active: formData.get("announcement_active") === "on",
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("site_settings")
    .update({
      ...parsed.data,
      logo_url: parsed.data.logo_url || null,
      whatsapp: parsed.data.whatsapp || null,
      email: parsed.data.email || null,
      instagram: parsed.data.instagram || null,
      tiktok: parsed.data.tiktok || null,
      youtube: parsed.data.youtube || null,
      shipping_note: parsed.data.shipping_note || null,
      free_shipping_note: parsed.data.free_shipping_note || null,
      announcement: parsed.data.announcement || null,
    })
    .eq("id", 1);

  if (error) return { status: "error", message: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/admin/configuracoes");
  return { status: "success" };
}
