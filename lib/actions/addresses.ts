"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { addressSchema } from "@/lib/validations/address";
import { requireUser } from "@/lib/auth/guards";
import { getDb, schema } from "@/lib/db";

export type ActionResult = { status: "idle" | "error" | "success"; message?: string };

const { addresses } = schema;

// Every query below is scoped to the signed-in user's own rows: the
// address id comes from the browser, the owner never does.

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

  const user = await requireUser();
  const db = getDb();

  const insert = db.insert(addresses).values({ ...parsed.data, customer_id: user.id });
  try {
    if (parsed.data.is_default) {
      // Only one default at a time.
      await db.batch([
        db.update(addresses).set({ is_default: false }).where(eq(addresses.customer_id, user.id)),
        insert,
      ]);
    } else {
      await insert;
    }
  } catch (error) {
    console.error("[createAddressAction]", error);
    return {
      status: "error",
      message: "Não foi possível salvar o endereço. Complete seu cadastro e tente de novo.",
    };
  }

  revalidatePath("/conta");
  return { status: "success" };
}

export async function deleteAddressAction(id: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const deleted = await getDb()
    .delete(addresses)
    .where(and(eq(addresses.id, id), eq(addresses.customer_id, user.id)))
    .returning({ id: addresses.id });
  revalidatePath("/conta");
  return { ok: deleted.length > 0 };
}

export async function setDefaultAddressAction(id: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const db = getDb();
  const own = await db.query.addresses.findFirst({
    columns: { id: true },
    where: and(eq(addresses.id, id), eq(addresses.customer_id, user.id)),
  });
  if (!own) return { ok: false };

  await db.batch([
    db.update(addresses).set({ is_default: false }).where(eq(addresses.customer_id, user.id)),
    db.update(addresses).set({ is_default: true }).where(eq(addresses.id, own.id)),
  ]);
  revalidatePath("/conta");
  return { ok: true };
}
