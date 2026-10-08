"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { couponSchema } from "@/lib/validations/coupon";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb, schema } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/errors";
import { isCouponLimitError } from "@/lib/coupons/usage";

export type ActionResult = { status: "idle" | "error" | "success"; message?: string };

const { coupons } = schema;

function parseFormData(formData: FormData) {
  return couponSchema.safeParse({
    code: formData.get("code") ?? "",
    type: formData.get("type"),
    value: formData.get("value"),
    min_total: formData.get("min_total"),
    max_uses: formData.get("max_uses"),
    starts_at: formData.get("starts_at"),
    expires_at: formData.get("expires_at"),
    free_shipping: formData.get("free_shipping") === "on",
    one_per_phone: formData.get("one_per_phone") === "on",
    active: formData.get("active") === "on",
  });
}

function saveError(error: unknown): ActionResult {
  if (isUniqueViolation(error, "coupons.code")) {
    return { status: "error", message: "Já existe um cupom com esse código." };
  }
  // coupons_usage_check: the limit typed is under the uses already taken.
  if (isCouponLimitError(error)) {
    return {
      status: "error",
      message: "O limite de usos não pode ser menor que os usos que o cupom já teve.",
    };
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
    await getDb().insert(coupons).values(parsed.data);
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
    // `used_count` is never set from the form: it belongs to the orders.
    await getDb().update(coupons).set(parsed.data).where(eq(coupons.id, id));
  } catch (error) {
    return saveError(error);
  }

  revalidatePath("/admin/cupons");
  redirect("/admin/cupons");
}

export async function toggleCouponActiveAction(
  id: string,
  active: boolean,
): Promise<{ ok: boolean }> {
  await requireAdmin();
  const updated = await getDb()
    .update(coupons)
    .set({ active })
    .where(eq(coupons.id, id))
    .returning({ id: coupons.id });
  revalidatePath("/admin/cupons");
  return { ok: updated.length > 0 };
}

/**
 * Orders that used it keep their code and discount (orders.coupon_code is
 * plain text); only the coupon itself goes. To stop it without losing its
 * history, deactivate it instead.
 */
export async function deleteCouponAction(id: string): Promise<{ ok: boolean; message?: string }> {
  await requireAdmin();
  await getDb().delete(coupons).where(eq(coupons.id, id));
  revalidatePath("/admin/cupons");
  return { ok: true };
}
