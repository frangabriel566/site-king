"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  requestPasswordResetAction,
  type PasswordResetState,
} from "@/lib/actions/password-reset";

const initialState: PasswordResetState = { status: "idle" };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-6">
        <p
          role="status"
          className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-fg"
        >
          {state.message}
        </p>
        <Link href="/conta" className="text-sm font-medium text-fg underline underline-offset-4">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="forgot-email">E-mail</Label>
        <Input id="forgot-email" name="email" type="email" autoComplete="email" required />
      </div>
      {state.status === "error" && state.message && (
        <p role="alert" className="text-xs text-[var(--danger)]">
          {state.message}
        </p>
      )}
      <Button type="submit" size="xl" disabled={pending}>
        {pending ? "Enviando…" : "Enviar link"}
      </Button>
      <Link href="/conta" className="text-center text-sm text-ink-muted underline underline-offset-4">
        Lembrei a senha
      </Link>
    </form>
  );
}
