"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveBirthdayMessageAction } from "@/lib/actions/store-sales";
import { BIRTHDAY_MESSAGE_MAX, DEFAULT_BIRTHDAY_MESSAGE, buildBirthdayMessage } from "@/lib/store-sales/birthday";

/** The text every "Mandar mensagem" opens with. */
export function BirthdayMessageForm({ saved, storeName }: { saved: string | null; storeName: string }) {
  const [message, setMessage] = useState(saved ?? DEFAULT_BIRTHDAY_MESSAGE);
  const [pending, startTransition] = useTransition();
  const unchanged = message.trim() === (saved ?? DEFAULT_BIRTHDAY_MESSAGE).trim();

  function save() {
    startTransition(async () => {
      // The default text is saved as "nothing", so an improved default
      // reaches a store that never changed it.
      const value = message.trim() === DEFAULT_BIRTHDAY_MESSAGE ? "" : message;
      const result = await saveBirthdayMessageAction({ message: value });
      if (result.ok) toast.success("Mensagem de aniversário salva.");
      else toast.error(result.message ?? "Não foi possível salvar.");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Label htmlFor="birthday-message">Mensagem</Label>
      <Textarea
        id="birthday-message"
        value={message}
        maxLength={BIRTHDAY_MESSAGE_MAX}
        onChange={(event) => setMessage(event.target.value)}
        className="min-h-24"
      />
      <p className="text-xs text-ink-muted">
        <code className="text-fg">{"{nome}"}</code> vira o primeiro nome do cliente e{" "}
        <code className="text-fg">{"{loja}"}</code> o nome da loja. Coloque aqui o desconto que você
        quer oferecer.
      </p>
      <div className="rounded-lg border border-line bg-field p-3 text-sm">
        <p className="text-label mb-1">Prévia</p>
        <p className="whitespace-pre-wrap">{buildBirthdayMessage(message, { name: "Maria Silva", storeName })}</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={pending || unchanged}>
          {pending ? "Salvando…" : "Salvar mensagem"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setMessage(DEFAULT_BIRTHDAY_MESSAGE)}
          disabled={pending || message === DEFAULT_BIRTHDAY_MESSAGE}
        >
          Voltar ao texto padrão
        </Button>
      </div>
    </div>
  );
}
