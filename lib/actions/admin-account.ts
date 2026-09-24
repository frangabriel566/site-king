"use server";

import { revalidatePath } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import {
  changeEmailSchema,
  changePasswordSchema,
} from "@/lib/validations/admin-account";
import { requireAdmin } from "./require-admin";

export type AccountActionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

/**
 * Confere a senha atual sem encostar na sessão de quem está logado.
 *
 * O cliente aqui é o `createPublicClient` — chave anon, `persistSession:
 * false`, nenhum cookie. Usar o cliente da sessão faria este
 * `signInWithPassword` reescrever os cookies do admin no meio da própria
 * troca de senha, e um erro no passo seguinte o deixaria numa sessão
 * nova que ele não pediu.
 *
 * Existe porque `updateUser()` não pede a senha antiga: sem esta
 * checagem, qualquer aba esquecida aberta viraria uma conta tomada.
 */
async function currentPasswordMatches(email: string, password: string): Promise<boolean> {
  const probe = createPublicClient();
  const { error } = await probe.auth.signInWithPassword({ email, password });
  return !error;
}

/** O GoTrue responde em inglês; isto é o que o operador lê. Só os casos
 *  que dependem do que ele digitou viram frase própria — o resto vira
 *  uma mensagem genérica com o original no log do servidor. */
function translateAuthError(message: string | undefined, context: string): string {
  const raw = (message ?? "").toLowerCase();

  if (raw.includes("different from the old password")) {
    return "A nova senha precisa ser diferente da atual.";
  }
  if (raw.includes("weak") || raw.includes("pwned") || raw.includes("at least")) {
    return "Senha recusada por ser fraca demais. Escolha uma mais longa.";
  }
  if (raw.includes("already been registered") || raw.includes("already registered")) {
    return "Já existe uma conta com esse e-mail.";
  }
  // O GoTrue tem a própria lista de endereços aceitáveis, mais estreita
  // que o formato que o Zod valida: domínios de exemplo e descartáveis
  // passam no `z.email()` e morrem aqui.
  if (raw.includes("is invalid") || raw.includes("invalid email")) {
    return "Endereço recusado pelo servidor. Use um e-mail real, que você consiga acessar.";
  }
  if (raw.includes("sending") || raw.includes("smtp")) {
    return "Não consegui enviar o e-mail de confirmação. Verifique o SMTP do projeto no Supabase.";
  }
  if (raw.includes("rate limit") || raw.includes("too many")) {
    return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  }

  console.error(`[${context}]`, message);
  return "Não foi possível concluir. Tente de novo.";
}

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

  const { supabase, user } = await requireAdmin();
  if (!user.email) {
    return { status: "error", message: "Esta conta não tem e-mail para confirmar a senha." };
  }

  if (!(await currentPasswordMatches(user.email, parsed.data.current_password))) {
    return { status: "error", message: "Senha atual incorreta." };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.new_password,
  });

  if (error) {
    return {
      status: "error",
      message: translateAuthError(error.message, "changeAdminPasswordAction"),
    };
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

  const { supabase, user } = await requireAdmin();
  if (!user.email) {
    return { status: "error", message: "Esta conta não tem e-mail de acesso." };
  }

  const newEmail = parsed.data.new_email.trim().toLowerCase();
  if (newEmail === user.email.toLowerCase()) {
    return { status: "error", message: "Este já é o seu e-mail de acesso." };
  }

  if (!(await currentPasswordMatches(user.email, parsed.data.current_password))) {
    return { status: "error", message: "Senha atual incorreta." };
  }

  const { data, error } = await supabase.auth.updateUser({ email: newEmail });

  if (error) {
    return {
      status: "error",
      message: translateAuthError(error.message, "changeAdminEmailAction"),
    };
  }

  // Com confirmação de e-mail ligada no Supabase, `updateUser` não troca
  // nada agora: guarda o endereço novo como pendente e manda um link. O
  // `user.email` que volta ainda é o antigo, e é assim que dá para saber
  // em qual dos dois mundos este projeto está, em vez de prometer ao
  // operador uma troca que não aconteceu.
  const appliedNow = data.user?.email?.toLowerCase() === newEmail;

  if (!appliedNow) {
    return {
      status: "success",
      message: `Confirme pelo link enviado para ${newEmail}. O acesso só muda depois disso.`,
    };
  }

  // profiles.email é o que a listagem de Clientes mostra (lib/data/customers)
  // — deixá-lo para trás apontaria para um endereço que não existe mais.
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ email: newEmail })
    .eq("id", user.id);

  if (profileError) {
    console.error("[changeAdminEmailAction] profiles.email dessincronizado", profileError);
  }

  revalidatePath("/admin", "layout");
  return { status: "success", message: "E-mail de acesso alterado." };
}
