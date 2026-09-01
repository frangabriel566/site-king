"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { couponSchema } from "@/lib/validations/coupon";
import { requireAdmin } from "./require-admin";

export type ActionResult = { status: "idle" | "error" | "success"; message?: string };

function parseFormData(formData: FormData) {
  return couponSchema.safeParse({
    code: formData.get("code"),
    type: formData.get("type"),
    value: formData.get("value"),
    min_total: formData.get("min_total"),
    active: formData.get("active") === "on",
    expires_at: formData.get("expires_at") || null,
  });
}

export async function createCouponAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("coupons").insert({
    ...parsed.data,
    expires_at: parsed.data.expires_at || null,
  });

  if (error) {
    return {
      status: "error",
      message: error.code === "23505" ? "Já existe um cupom com esse código." : error.message,
    };
  }

  revalidatePath("/admin/cupons");
  redirect("/admin/cupons");
}

export async function updateCouponAction(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("coupons")
    .update({ ...parsed.data, expires_at: parsed.data.expires_at || null })
    .eq("id", id);

  if (error) {
    return {
      status: "error",
      message: error.code === "23505" ? "Já existe um cupom com esse código." : error.message,
    };
  }

  revalidatePath("/admin/cupons");
  redirect("/admin/cupons");
}

export async function deleteCouponAction(id: string): Promise<{ ok: boolean; message?: string }> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("coupons").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/cupons");
  return { ok: true };
}
