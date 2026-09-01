"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signInSchema, signUpSchema } from "@/lib/validations/customer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuthState = { status: "idle" | "error" | "success"; message?: string };

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
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error || !data.user) {
    return {
      status: "error",
      message: error?.message === "User already registered"
        ? "Este e-mail já está cadastrado."
        : "Não foi possível criar a conta.",
    };
  }

  // Uses the service-role client so the customer profile row is created
  // immediately regardless of whether the Supabase project requires
  // e-mail confirmation before a session (and therefore auth.uid()) is
  // available for the normal RLS-scoped insert.
  const admin = createAdminClient();
  const { error: customerError } = await admin.from("customers").upsert({
    id: data.user.id,
    name,
    phone,
    birthdate,
  });

  if (customerError) {
    return { status: "error", message: "Não foi possível salvar seus dados." };
  }

  if (!data.session) {
    return {
      status: "error",
      message: "Confirme seu e-mail para concluir o cadastro e depois entre normalmente.",
    };
  }

  return { status: "success" };
}

async function performSignIn(formData: FormData): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { status: "error", message: "E-mail ou senha inválidos." };
  }

  return { status: "success" };
}

/** True when the currently-authenticated user has the admin role. */
async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.role === "admin";
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
  if (await isCurrentUserAdmin()) {
    redirect("/admin");
  }

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
  return performSignIn(formData);
}

export async function customerSignOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/conta");
  redirect("/");
}
