"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncOrderPaymentAction } from "@/lib/actions/orders";

/** Consulta o Mercado Pago na hora, para pedidos que o webhook não atualizou. */
export function SyncPaymentButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await syncOrderPaymentAction(orderId);
          if (result.ok) toast.success(result.message);
          else toast.error(result.message);
          router.refresh();
        })
      }
    >
      <RefreshCw className={pending ? "animate-spin" : undefined} />
      Verificar pagamento no Mercado Pago
    </Button>
  );
}
