"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { couponSchema } from "@/lib/validations/coupon";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb, schema } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/errors";

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

function saveError(error: unknown): ActionResult {
  if (isUniqueViolation(error, "coupons.code")) {
    return { status: "error", message: "Já existe um cupom com esse código." };
  }
  console.error("[coupons]", error);
  return { status: "error", message: "Não foi possível salvar o cupom." };
}

export async function createCouponAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  await requireAdmin();
  try {
    await getDb()
      .insert(schema.coupons)
      .values({ ...parsed.data, expires_at: parsed.data.expires_at || null });
  } catch (error) {
    return saveError(error);
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

  await requireAdmin();
  try {
    await getDb()
      .update(schema.coupons)
      .set({ ...parsed.data, expires_at: parsed.data.expires_at || null })
      .where(eq(schema.coupons.id, id));
  } catch (error) {
    return saveError(error);
  }

  revalidatePath("/admin/cupons");
  redirect("/admin/cupons");
}

export async function deleteCouponAction(id: string): Promise<{ ok: boolean; message?: string }> {
  await requireAdmin();
  await getDb().delete(schema.coupons).where(eq(schema.coupons.id, id));
  revalidatePath("/admin/cupons");
  return { ok: true };
}
