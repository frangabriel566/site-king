import { z } from "zod";

/** Mesmo mínimo do cadastro de cliente (lib/validations/customer.ts) —
 *  não faria sentido o painel aceitar senha mais fraca que a loja. */
const MIN_PASSWORD = 8;

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Informe sua senha atual"),
    new_password: z.string().min(MIN_PASSWORD, `Mínimo de ${MIN_PASSWORD} caracteres`),
    confirm_password: z.string().min(1, "Repita a nova senha"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "As duas senhas não conferem",
    path: ["confirm_password"],
  })
  .refine((data) => data.new_password !== data.current_password, {
    message: "A nova senha precisa ser diferente da atual",
    path: ["new_password"],
  });

export const changeEmailSchema = z.object({
  new_email: z.email("E-mail inválido"),
  // Pedida nas duas operações: sem isso, uma aba esquecida aberta num
  // computador compartilhado bastaria para alguém tomar a conta trocando
  // o e-mail de acesso.
  current_password: z.string().min(1, "Informe sua senha atual"),
});
