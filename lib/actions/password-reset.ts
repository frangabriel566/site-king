"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validations/customer";
import { getAuth } from "@/lib/auth/server";
import { authErrorCode } from "@/lib/auth/errors";

export type PasswordResetState = {
  status: "idle" | "error" | "success";
  message?: string;
};

/**
 * "Esqueci minha senha": asks Better Auth for a one-hour reset link, which
 * it hands to sendPasswordResetEmail (lib/email.ts → Resend).
 *
 * The answer is the same whether the address has an account or not, so
 * this form cannot be used to find out who shops here.
 */
export async function requestPasswordResetAction(
  _prev: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  const auth = await getAuth();
  try {
    await auth.api.requestPasswordReset({
      body: { email: parsed.data.email.trim().toLowerCase(), redirectTo: "/redefinir-senha" },
      headers: await headers(),
    });
  } catch (error) {
    console.error("[requestPasswordResetAction]", error);
  }

  return {
    status: "success",
    message:
      "Se existir uma conta com esse e-mail, enviamos um link para criar uma nova senha. Ele vale por 1 hora — confira também a caixa de spam.",
  };
}

export async function resetPasswordAction(
  _prev: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm_password: formData.get("confirm_password"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  const auth = await getAuth();
  try {
    await auth.api.resetPassword({
      body: { token: parsed.data.token, newPassword: parsed.data.password },
      headers: await headers(),
    });
  } catch (error) {
    const code = authErrorCode(error);
    if (code === "INVALID_TOKEN" || code === "USER_NOT_FOUND") {
      return {
        status: "error",
        message: "Este link expirou ou já foi usado. Peça um novo em “Esqueci minha senha”.",
      };
    }
    console.error("[resetPasswordAction]", error);
    return { status: "error", message: "Não foi possível redefinir a senha. Tente de novo." };
  }

  // Every session was revoked with the old password; sign in again.
  redirect("/conta?senha=redefinida");
}
