"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const newsletterSchema = z.object({
  email: z.email("Informe um e-mail válido"),
});

export type NewsletterState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export async function subscribeNewsletterAction(
  _prevState: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const parsed = newsletterSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("newsletter_subscribers")
    .insert({ email: parsed.data.email });

  if (error && error.code !== "23505") {
    return { status: "error", message: "Não foi possível cadastrar. Tente novamente." };
  }

  return { status: "success", message: "Inscrição confirmada." };
}
