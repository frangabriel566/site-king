"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changeAdminEmailAction,
  changeAdminPasswordAction,
  type AccountActionState,
} from "@/lib/actions/admin-account";

const initialState: AccountActionState = { status: "idle" };

/**
 * Troca de e-mail e de senha do acesso ao painel.
 *
 * Fica separada do formulário de Configurações de propósito: aquele
 * salva a loja (nome, redes, endereço de origem) e o operador o submete
 * sem pensar. Credencial não pode andar junto de um "Salvar" de rotina,
 * e cada uma destas duas operações pede a senha atual por conta própria.
 */
export function AccountForm({ email }: { email: string }) {
  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <EmailSection email={email} />
      <PasswordSection />
    </div>
  );
}

function EmailSection({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(
    changeAdminEmailAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "error" && state.message) toast.error(state.message);
    if (state.status === "success") {
      toast.success(state.message ?? "E-mail alterado.");
      // Limpa a senha digitada — ela não tem por que continuar no DOM
      // depois de usada, e o campo de e-mail novo já virou o atual.
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction}>
      <p className="text-label mb-1">E-mail de acesso</p>
      <p className="mb-4 text-sm text-ink-muted">
        É com ele que você entra no painel. Não tem relação com o e-mail de
        contato da loja, que aparece no rodapé do site.
      </p>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="current_email">Atual</Label>
          <Input id="current_email" value={email} readOnly disabled />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new_email">Novo e-mail</Label>
          <Input
            id="new_email"
            name="new_email"
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email_current_password">Sua senha atual</Label>
          <Input
            id="email_current_password"
            name="current_password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <Button type="submit" size="lg" disabled={pending} className="w-fit">
          {pending ? "Alterando…" : "Alterar e-mail"}
        </Button>
      </div>
    </form>
  );
}

function PasswordSection() {
  const [state, formAction, pending] = useActionState(
    changeAdminPasswordAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "error" && state.message) toast.error(state.message);
    if (state.status === "success") {
      toast.success(state.message ?? "Senha alterada.");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="border-t border-line pt-10">
      <p className="text-label mb-1">Senha</p>
      <p className="mb-4 text-sm text-ink-muted">
        Mínimo de 8 caracteres. Trocar a senha não desconecta esta aba.
      </p>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="current_password">Senha atual</Label>
          <Input
            id="current_password"
            name="current_password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new_password">Nova senha</Label>
          <Input
            id="new_password"
            name="new_password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm_password">Repita a nova senha</Label>
          <Input
            id="confirm_password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <Button type="submit" size="lg" disabled={pending} className="w-fit">
          {pending ? "Alterando…" : "Alterar senha"}
        </Button>
      </div>
    </form>
  );
}
