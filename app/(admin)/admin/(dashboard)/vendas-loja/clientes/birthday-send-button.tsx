"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/shop/whatsapp-icon";
import { markBirthdaySentAction } from "@/lib/actions/store-sales";

/**
 * Opens the birthday message in WhatsApp, ready to send. The panel can't
 * know whether it was sent, so opening it is what marks the birthday as
 * done — the button stays, for a second try.
 */
export function BirthdaySendButton({
  customerId,
  href,
  sent,
}: {
  customerId: string;
  href: string;
  sent: boolean;
}) {
  const [marked, setMarked] = useState(sent);
  const [, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button asChild size="sm" variant={marked ? "outline" : "default"}>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            setMarked(true);
            startTransition(async () => {
              await markBirthdaySentAction({ customer_id: customerId });
            });
          }}
        >
          <WhatsAppIcon className="size-3.5" />
          {marked ? "Mandar de novo" : "Mandar mensagem"}
        </a>
      </Button>
      {marked && (
        <span className="flex items-center gap-1 text-xs text-[var(--success)]">
          <Check className="size-3" aria-hidden="true" />
          Mensagem aberta
        </span>
      )}
    </div>
  );
}
