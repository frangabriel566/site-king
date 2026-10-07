"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { toggleCouponActiveAction } from "@/lib/actions/coupons";

export function CouponActiveToggle({
  id,
  code,
  active,
}: {
  id: string;
  code: string;
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
          const result = await toggleCouponActiveAction(id, checked);
          if (result.ok) {
            toast.success(checked ? `Cupom ${code} ativado.` : `Cupom ${code} desativado.`);
            router.refresh();
          } else {
            toast.error("Não foi possível atualizar o cupom.");
          }
        });
      }}
      aria-label={active ? `Desativar o cupom ${code}` : `Ativar o cupom ${code}`}
    />
  );
}
