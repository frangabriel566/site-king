"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { toggleBannerActiveAction } from "@/lib/actions/banners";

export function BannerActiveToggle({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Switch
      checked={active}
      disabled={pending}
      onCheckedChange={(checked) => {
        startTransition(async () => {
          const result = await toggleBannerActiveAction(id, checked);
          if (result.ok) {
            toast.success(checked ? "Banner ativado." : "Banner desativado.");
            router.refresh();
          } else {
            toast.error("Não foi possível atualizar o banner.");
          }
        });
      }}
      aria-label={active ? "Desativar banner" : "Ativar banner"}
    />
  );
}
