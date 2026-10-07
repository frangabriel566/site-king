"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signInSchema, signUpSchema } from "@/lib/validations/customer";
import { getAuth } from "@/lib/auth/server";
import { authErrorCode } from "@/lib/auth/errors";
import { getDb, schema } from "@/lib/db";

/** `pending` was "account created, waiting for the e-mail link" under
 *  Supabase. Sign-up no longer requires confirmation, so it is not
 *  returned today; kept so the forms keep handling it if confirmation is
 *  switched back on (lib/auth/server.ts). */
export type AuthState = {
  status: "idle" | "error" | "success" | "pending";
  message?: string;
};

type SignInResult = AuthState & { isAdmin?: boolean };

async function performSignUp(formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone"),
    birthdate: formData.get("birthdate"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  const { name, email, password, phone, birthdate } = parsed.data;
  const auth = await getAuth();

  let userId: string;
  try {
    // Creates the user and, through the nextCookies plugin, signs them in.
    const result = await auth.api.signUpEmail({
      body: { name, email, password },
      headers: await headers(),
    });
    userId = result.user.id;
  } catch (error) {
    const code = authErrorCode(error);
    if (code?.startsWith("USER_ALREADY_EXISTS")) {
      return { status: "error", message: "Este e-mail já está cadastrado." };
    }
    console.error("[performSignUp]", error);
    return { status: "error", message: "Não foi possível criar a conta." };
  }

  try {
    await getDb().insert(schema.customers).values({ id: userId, name, phone, birthdate });
  } catch (error) {
    console.error("[performSignUp] customers", error);
    return { status: "error", message: "Não foi possível salvar seus dados." };
  }

  return { status: "success" };
}

async function performSignIn(formData: FormData): Promise<SignInResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  const auth = await getAuth();
  try {
    const result = await auth.api.signInEmail({
      body: parsed.data,
      headers: await headers(),
    });
    const role = (result.user as { role?: string }).role;
    return { status: "success", isAdmin: role === "admin" };
  } catch (error) {
    if (!authErrorCode(error)) console.error("[performSignIn]", error);
    return { status: "error", message: "E-mail ou senha inválidos." };
  }
}

/** Page variants — used on /conta, redirect there on success. */

export async function customerSignUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const result = await performSignUp(formData);
  if (result.status !== "success") return result;
  revalidatePath("/conta");
  redirect("/conta");
}

export async function customerSignInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const result = await performSignIn(formData);
  if (result.status !== "success") return result;

  // A store admin logging in through the public "Conta" entry point goes
  // straight to the admin panel instead of the customer account page —
  // one login box, no separate /admin/login URL to remember.
  if (result.isAdmin) redirect("/admin");

  revalidatePath("/conta");
  redirect("/conta");
}

/**
 * Embedded variants — used inside the checkout wizard's "dados" step,
 * where a full-page redirect to /conta would knock the shopper out of
 * checkout. These just report success and let the client advance to
 * the next step in place.
 */

export async function checkoutSignUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  return performSignUp(formData);
}

export async function checkoutSignInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { status, message } = await performSignIn(formData);
  return { status, message };
}

export async function customerSignOutAction(): Promise<void> {
  const auth = await getAuth();
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    console.error("[customerSignOutAction]", error);
  }
  revalidatePath("/conta");
  redirect("/");
}
