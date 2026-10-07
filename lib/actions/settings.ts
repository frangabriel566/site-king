"use server";

import { revalidatePath } from "next/cache";
import { siteSettingsSchema } from "@/lib/validations/settings";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb, schema } from "@/lib/db";

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
    installments_max: formData.get("installments_max"),
    pix_discount_percent: formData.get("pix_discount_percent"),
    free_shipping_threshold: formData.get("free_shipping_threshold"),
    new_product_days: formData.get("new_product_days"),
    low_stock_units: formData.get("low_stock_units"),
    exchange_note: formData.get("exchange_note"),
    secure_purchase_note: formData.get("secure_purchase_note"),
    footer_payment_text: formData.get("footer_payment_text"),
    footer_security_text: formData.get("footer_security_text"),
    footer_privacy_text: formData.get("footer_privacy_text"),
    origin_document: formData.get("origin_document"),
    origin_cep: formData.get("origin_cep"),
    origin_street: formData.get("origin_street"),
    origin_number: formData.get("origin_number"),
    origin_complement: formData.get("origin_complement"),
    origin_district: formData.get("origin_district"),
    origin_city: formData.get("origin_city"),
    origin_state: formData.get("origin_state"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  await requireAdmin();

  const values = {
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
    exchange_note: parsed.data.exchange_note || null,
    secure_purchase_note: parsed.data.secure_purchase_note || null,
    footer_payment_text: parsed.data.footer_payment_text || null,
    footer_security_text: parsed.data.footer_security_text || null,
    footer_privacy_text: parsed.data.footer_privacy_text || null,
    origin_document: parsed.data.origin_document || null,
    origin_cep: parsed.data.origin_cep || null,
    origin_street: parsed.data.origin_street || null,
    origin_number: parsed.data.origin_number || null,
    origin_complement: parsed.data.origin_complement || null,
    origin_district: parsed.data.origin_district || null,
    origin_city: parsed.data.origin_city || null,
    origin_state: parsed.data.origin_state || null,
  };

  try {
    // Single row, id = 1. An upsert, so a fresh database without the seed
    // row still saves on the first try.
    await getDb()
      .insert(schema.site_settings)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({ target: schema.site_settings.id, set: values });
  } catch (error) {
    console.error("[updateSiteSettingsAction]", error);
    return { status: "error", message: "Não foi possível salvar as configurações." };
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin/configuracoes");
  return { status: "success" };
}
