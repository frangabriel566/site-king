"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuth } from "@/lib/auth/server";
import { findUserByEmail, passwordMatches } from "@/lib/auth/accounts";

const loginSchema = z.object({
  email: z.email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

export type AdminLoginState = {
  status: "idle" | "error";
  message?: string;
};

const INVALID = "E-mail ou senha inválidos.";

export async function adminLoginAction(
  _prevState: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  const account = await findUserByEmail(parsed.data.email);
  if (!account) return { status: "error", message: INVALID };

  // A customer account with the right password is told it has no access —
  // but without a session ever being opened for it on the panel's door.
  if (account.role !== "admin") {
    const ok = await passwordMatches(account.id, parsed.data.password);
    return {
      status: "error",
      message: ok ? "Esta conta não tem acesso ao painel." : INVALID,
    };
  }

  const auth = await getAuth();
  try {
    await auth.api.signInEmail({ body: parsed.data, headers: await headers() });
  } catch {
    return { status: "error", message: INVALID };
  }

  const next = String(formData.get("next") ?? "/admin");
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function adminLogoutAction(): Promise<void> {
  const auth = await getAuth();
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    console.error("[adminLogoutAction]", error);
  }
  redirect("/");
}
