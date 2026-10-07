import { z } from "zod";

const phoneDigits = (value: string) => value.replace(/\D/g, "");

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Telefone obrigatório")
  .refine((v) => {
    const digits = phoneDigits(v);
    return digits.length === 10 || digits.length === 11;
  }, "Informe um telefone válido com DDD");

export const birthdateSchema = z
  .iso.date("Data de nascimento inválida")
  .refine((v) => new Date(v) <= new Date(), "Data não pode ser no futuro")
  .refine((v) => {
    const years =
      (Date.now() - new Date(v).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return years >= 16;
  }, "É preciso ter ao menos 16 anos");

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(160),
  phone: phoneSchema,
  birthdate: birthdateSchema,
});

export type CustomerInput = z.infer<typeof customerSchema>;

export const signUpSchema = customerSchema.extend({
  email: z.email("E-mail inválido"),
  password: z.string().min(8, "Mínimo de 8 caracteres"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

export type SignInInput = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({
  email: z.email("E-mail inválido"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Link inválido. Peça um novo."),
    password: z.string().min(8, "Mínimo de 8 caracteres").max(128, "Máximo de 128 caracteres"),
    confirm_password: z.string().min(1, "Repita a nova senha"),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "As duas senhas não conferem",
    path: ["confirm_password"],
  });
