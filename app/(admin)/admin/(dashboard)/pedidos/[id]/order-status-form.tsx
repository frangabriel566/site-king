"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateOrderStatusAction } from "@/lib/actions/orders";

const STATUS_OPTIONS = [
  { value: "pending", label: "Aguardando pagamento" },
  { value: "paid", label: "Pago" },
  { value: "processing", label: "Em preparação" },
  { value: "shipped", label: "Enviado" },
  { value: "delivered", label: "Entregue" },
  { value: "canceled", label: "Cancelado" },
  // Presente só para o Select ter o que mostrar quando o pedido já chegou
  // aqui expirado — sem uma opção com esse valor, o gatilho aparecia em
  // branco. Desabilitado porque nada volta a "expirado" por escolha: quem
  // põe um pedido nesse estado é expire_whatsapp_orders(), e a Server
  // Action recusa o valor de qualquer jeito (orderStatusSchema).
  { value: "expirado", label: "Expirado", disabled: true },
];

export function OrderStatusForm({
  orderId,
  currentStatus,
  currentTrackingCode,
}: {
  orderId: string;
  currentStatus: string;
  currentTrackingCode: string | null;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [trackingCode, setTrackingCode] = useState(currentTrackingCode ?? "");
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updateOrderStatusAction({
        order_id: orderId,
        status,
        tracking_code: trackingCode,
      });
      if (result.ok) {
        toast.success("Pedido atualizado.");
      } else {
        toast.error(result.message ?? "Não foi possível atualizar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-card p-5 print:hidden">
      <div className="flex flex-col gap-2">
        <Label htmlFor="order-status">Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger id="order-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="tracking-code">Código de rastreio</Label>
        <Input
          id="tracking-code"
          value={trackingCode}
          onChange={(e) => setTrackingCode(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={pending} size="lg">
          {pending ? "Salvando…" : "Salvar"}
        </Button>
        <Button variant="outline" size="lg" onClick={() => window.print()}>
          <Printer className="size-4" /> Imprimir
        </Button>
      </div>
    </div>
  );
}
