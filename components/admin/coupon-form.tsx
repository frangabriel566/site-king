"use client";

import { startTransition, useActionState, useEffect } from "react";
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
    // Submitted by hand rather than with `action={formAction}`: React 19
    // clears a form after its action runs, even when the server answers with
    // a validation error — every field typed so far was lost and the next
    // try went out with an empty code.
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="flex max-w-xl flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">Código</Label>
        <Input
          id="code"
          name="code"
          required
          defaultValue={coupon?.code}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="ex.: BEMVINDO10"
          className="uppercase placeholder:normal-case"
        />
        <p className="text-xs text-ink-muted">
          Salvo em maiúsculas e sem espaços; o cliente pode digitar de qualquer jeito.
        </p>
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
            inputMode="decimal"
            required
            placeholder="ex.: 10"
            defaultValue={coupon?.value}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="free_shipping" name="free_shipping" defaultChecked={coupon?.free_shipping ?? false} />
        <Label htmlFor="free_shipping">Também zera o frete</Label>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="min_total">Pedido mínimo (R$)</Label>
          <Input
            id="min_total"
            name="min_total"
            inputMode="decimal"
            placeholder="Sem mínimo"
            defaultValue={coupon?.min_total ? coupon.min_total : ""}
          />
          <p className="text-xs text-ink-muted">Sobre o subtotal dos produtos, sem o frete.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="max_uses">Limite de usos</Label>
          <Input
            id="max_uses"
            name="max_uses"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="Sem limite"
            defaultValue={coupon?.max_uses ?? ""}
          />
          <p className="text-xs text-ink-muted">
            {coupon ? `Usado ${coupon.used_count} ${coupon.used_count === 1 ? "vez" : "vezes"} até agora. ` : ""}
            Pedido cancelado ou expirado devolve o uso.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="starts_at">Começa em</Label>
          <Input
            id="starts_at"
            name="starts_at"
            type="date"
            defaultValue={coupon?.starts_at ? coupon.starts_at.slice(0, 10) : ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="expires_at">Vale até</Label>
          <Input
            id="expires_at"
            name="expires_at"
            type="date"
            defaultValue={coupon?.expires_at ? coupon.expires_at.slice(0, 10) : ""}
          />
        </div>
      </div>
      <p className="-mt-3 text-xs text-ink-muted">
        Datas em horário de Brasília: o cupom vale do início do primeiro dia até 23:59 do
        último. Em branco, sem limite.
      </p>
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
