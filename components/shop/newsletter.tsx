"use client";

import { useActionState, useEffect, useRef } from "react";
import { subscribeNewsletterAction, type NewsletterState } from "@/lib/actions/newsletter";
import { Button } from "@/components/ui/button";

const initialState: NewsletterState = { status: "idle" };

export function Newsletter({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [state, formAction, pending] = useActionState(
    subscribeNewsletterAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const dark = variant === "dark";

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-4 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <label
          htmlFor="newsletter-email"
          className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${dark ? "text-bg/60" : "text-muted-foreground"}`}
        >
          Newsletter
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          placeholder="seu@email.com"
          className={`w-full border-b py-3 text-sm outline-none focus:border-gold ${
            dark
              ? "border-white/20 bg-transparent text-bg placeholder:text-bg/40"
              : "border-line bg-transparent text-fg placeholder:text-muted-foreground"
          }`}
        />
      </div>
      <Button type="submit" size="xl" disabled={pending}>
        {pending ? "Enviando…" : "Inscrever-se"}
      </Button>
      <p aria-live="polite" className="sr-only">
        {state.status === "success" ? state.message : ""}
        {state.status === "error" ? state.message : ""}
      </p>
      {state.status !== "idle" && (
        <p
          className={`text-xs ${
            state.status === "success"
              ? dark
                ? "text-bg/60"
                : "text-muted-foreground"
              : "text-alert"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
