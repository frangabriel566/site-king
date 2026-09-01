"use server";

import { revalidatePath } from "next/cache";
import { addressSchema } from "@/lib/validations/address";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { status: "idle" | "error" | "success"; message?: string };

async function requireCustomer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return { supabase, userId: user.id };
}

export async function createAddressAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = addressSchema.safeParse({
    cep: formData.get("cep"),
    street: formData.get("street"),
    number: formData.get("number"),
    complement: formData.get("complement"),
    district: formData.get("district"),
    city: formData.get("city"),
    state: formData.get("state"),
    is_default: formData.get("is_default") === "on",
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  const { supabase, userId } = await requireCustomer();

  if (parsed.data.is_default) {
    await supabase.from("addresses").update({ is_default: false }).eq("customer_id", userId);
  }

  const { error } = await supabase.from("addresses").insert({
    ...parsed.data,
    customer_id: userId,
  });

  if (error) return { status: "error", message: error.message };

  revalidatePath("/conta");
  return { status: "success" };
}

export async function deleteAddressAction(id: string): Promise<{ ok: boolean }> {
  const { supabase } = await requireCustomer();
  const { error } = await supabase.from("addresses").delete().eq("id", id);
  revalidatePath("/conta");
  return { ok: !error };
}

export async function setDefaultAddressAction(id: string): Promise<{ ok: boolean }> {
  const { supabase, userId } = await requireCustomer();
  await supabase.from("addresses").update({ is_default: false }).eq("customer_id", userId);
  const { error } = await supabase
    .from("addresses")
    .update({ is_default: true })
    .eq("id", id);
  revalidatePath("/conta");
  return { ok: !error };
}
