"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionResult } from "@/lib/actions/coupons";
import type { Coupon } from "@/lib/data/coupons";

const initialState: ActionResult = { status: "idle" };

export function CouponForm({
  coupon,
  action,
}: {
  coupon?: Coupon;
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">Código</Label>
        <Input
          id="code"
          name="code"
          required
          defaultValue={coupon?.code}
          className="uppercase"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="type">Tipo</Label>
          <Select name="type" defaultValue={coupon?.type ?? "percent"}>
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">Percentual (%)</SelectItem>
              <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="value">Valor</Label>
          <Input
            id="value"
            name="value"
            type="number"
            step="0.01"
            min={0}
            required
            defaultValue={coupon?.value}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="min_total">Pedido mínimo (R$)</Label>
        <Input
          id="min_total"
          name="min_total"
          type="number"
          step="0.01"
          min={0}
          defaultValue={coupon?.min_total ?? 0}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="expires_at">Expira em</Label>
        <Input
          id="expires_at"
          name="expires_at"
          type="date"
          defaultValue={coupon?.expires_at ? coupon.expires_at.slice(0, 10) : ""}
        />
      </div>
      <div className="flex items-center gap-3">
        <Switch id="active" name="active" defaultChecked={coupon?.active ?? true} />
        <Label htmlFor="active">Ativo</Label>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.push("/admin/cupons")}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
