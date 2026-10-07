"use server";

import { z } from "zod";
import { getDb, schema } from "@/lib/db";

const newsletterSchema = z.object({
  email: z.email("Informe um e-mail válido"),
});

export type NewsletterState = {
  status: "idle" | "success" | "error";
  message?: string;
};

/** Open to anyone (no session needed); only admins can read the list. */
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

  try {
    // Subscribing twice is not an error the visitor needs to see.
    await getDb()
      .insert(schema.newsletter_subscribers)
      .values({ email: parsed.data.email.trim().toLowerCase() })
      .onConflictDoNothing({ target: schema.newsletter_subscribers.email });
  } catch (error) {
    console.error("[subscribeNewsletterAction]", error);
    return { status: "error", message: "Não foi possível cadastrar. Tente novamente." };
  }

  return { status: "success", message: "Inscrição confirmada." };
}
