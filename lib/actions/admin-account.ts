"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import {
  changeEmailSchema,
  changePasswordSchema,
} from "@/lib/validations/admin-account";
import { requireAdmin } from "@/lib/auth/guards";
import { getAuth } from "@/lib/auth/server";
import { authErrorCode } from "@/lib/auth/errors";
import { findUserByEmail, passwordMatches } from "@/lib/auth/accounts";
import { getDb, schema } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/errors";

export type AccountActionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export async function changeAdminPasswordAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = changePasswordSchema.safeParse({
    current_password: formData.get("current_password"),
    new_password: formData.get("new_password"),
    confirm_password: formData.get("confirm_password"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  await requireAdmin();
  const auth = await getAuth();

  try {
    // Better Auth checks the current password itself before changing it —
    // without that, any forgotten open tab would be an account takeover.
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.current_password,
        newPassword: parsed.data.new_password,
        revokeOtherSessions: false,
      },
      headers: await headers(),
    });
  } catch (error) {
    const code = authErrorCode(error);
    if (code === "INVALID_PASSWORD") {
      return { status: "error", message: "Senha atual incorreta." };
    }
    if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") {
      return { status: "error", message: "A nova senha precisa ter de 8 a 128 caracteres." };
    }
    console.error("[changeAdminPasswordAction]", error);
    return { status: "error", message: "Não foi possível concluir. Tente de novo." };
  }

  return { status: "success", message: "Senha alterada." };
}

export async function changeAdminEmailAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = changeEmailSchema.safeParse({
    new_email: formData.get("new_email"),
    current_password: formData.get("current_password"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  const admin = await requireAdmin();
  const newEmail = parsed.data.new_email.trim().toLowerCase();
  if (newEmail === admin.email.toLowerCase()) {
    return { status: "error", message: "Este já é o seu e-mail de acesso." };
  }

  // Asked for on both operations: without it, a forgotten open tab on a
  // shared computer would be enough to take the account over.
  if (!(await passwordMatches(admin.id, parsed.data.current_password))) {
    return { status: "error", message: "Senha atual incorreta." };
  }

  if (await findUserByEmail(newEmail)) {
    return { status: "error", message: "Já existe uma conta com esse e-mail." };
  }

  // Applied right away: there is no e-mail confirmation in this setup (see
  // lib/auth/server.ts). Sessions point at the user id, not the address,
  // so the operator stays signed in.
  try {
    await getDb()
      .update(schema.user)
      .set({ email: newEmail, emailVerified: false })
      .where(eq(schema.user.id, admin.id));
  } catch (error) {
    if (isUniqueViolation(error, "user.email")) {
      return { status: "error", message: "Já existe uma conta com esse e-mail." };
    }
    console.error("[changeAdminEmailAction]", error);
    return { status: "error", message: "Não foi possível concluir. Tente de novo." };
  }

  revalidatePath("/admin", "layout");
  return { status: "success", message: "E-mail de acesso alterado." };
}
