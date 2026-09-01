"use client";

import { useActionState, useEffect, useRef } from "react";
import { subscribeNewsletterAction, type NewsletterState } from "@/lib/actions/newsletter";
import { Button } from "@/components/ui/button";

const initialState: NewsletterState = { status: "idle" };

export function Newsletter() {
  const [state, formAction, pending] = useActionState(
    subscribeNewsletterAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

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
        <label htmlFor="newsletter-email" className="text-label mb-2 block">
          Newsletter
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          placeholder="seu@email.com"
          className="w-full border-b border-line bg-transparent py-3 text-sm text-fg outline-none placeholder:text-ink-muted focus:border-gold"
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
          className={
            state.status === "success"
              ? "text-xs text-ink-muted"
              : "text-xs text-[var(--danger)]"
          }
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
