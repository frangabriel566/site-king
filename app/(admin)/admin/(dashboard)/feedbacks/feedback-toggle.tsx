"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { toggleFeedbackAction } from "@/lib/actions/feedbacks";

const LABELS = {
  active: { on: "Feedback ativado.", off: "Feedback desativado.", aria: "Ativo" },
  show_on_home: { on: "Agora aparece na home.", off: "Saiu da home.", aria: "Na home" },
};

/** Ativo / Na home, straight from the list. */
export function FeedbackToggle({
  id,
  field,
  value,
  name,
}: {
  id: string;
  field: "active" | "show_on_home";
  value: boolean;
  name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const labels = LABELS[field];

  return (
    <Switch
      checked={value}
      disabled={pending}
      aria-label={`${labels.aria}: ${name}`}
      onCheckedChange={(checked) =>
        startTransition(async () => {
          const result = await toggleFeedbackAction(id, field, checked);
          if (!result.ok) {
            toast.error("Não foi possível atualizar o feedback.");
            return;
          }
          toast.success(checked ? labels.on : labels.off);
          router.refresh();
        })
      }
    />
  );
}
