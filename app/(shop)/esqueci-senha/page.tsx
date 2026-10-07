import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function ForgotPasswordPage() {
  return (
    <div className="px-8 py-16 md:px-12">
      <div className="mx-auto max-w-sm">
        <h1 className="mb-3 text-2xl font-bold text-fg md:text-3xl">Esqueci minha senha</h1>
        <p className="mb-8 text-sm text-ink-muted">
          Informe o e-mail da sua conta. Enviamos um link para você criar uma nova senha.
        </p>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
