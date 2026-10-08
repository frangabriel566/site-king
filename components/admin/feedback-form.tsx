"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  FeedbackImagesEditor,
  type FeedbackImageDraft,
} from "@/components/admin/feedback-images-editor";
import { formatCustomerName } from "@/lib/format";
import { FEEDBACK_TEXT_MAX } from "@/lib/validations/feedback";
import type { ActionResult } from "@/lib/actions/feedbacks";
import type { AdminFeedback } from "@/lib/data/feedbacks";

const initialState: ActionResult = { status: "idle" };

export type ProductPick = { id: string; name: string };

/** Today in the browser's own calendar (not UTC), as YYYY-MM-DD. */
function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function FeedbackForm({
  feedback,
  products,
  action,
}: {
  feedback?: AdminFeedback;
  products: ProductPick[];
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();
  const savingRef = useRef(false);

  const [name, setName] = useState(feedback?.customer_name ?? "");
  const [rating, setRating] = useState<number | null>(feedback?.rating ?? null);
  const [productId, setProductId] = useState<string | null>(feedback?.product_id ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [text, setText] = useState(feedback?.text ?? "");
  const [images, setImages] = useState<FeedbackImageDraft[]>(
    () =>
      feedback?.feedback_images.map((image) => ({
        url: image.url,
        kind: image.kind,
        width: image.width,
        height: image.height,
      })) ?? [],
  );

  useEffect(() => {
    if (state.status === "error") {
      savingRef.current = false;
      if (state.message) toast.error(state.message);
    }
  }, [state]);

  const product = products.find((option) => option.id === productId) ?? null;
  const empty = !text.trim() && images.length === 0;

  return (
    // Submitted by hand rather than with `action={formAction}`: React 19
    // clears a form after its action runs, even on a validation error,
    // and every field typed — the images included — would be lost.
    <form
      onSubmit={(event) => {
        event.preventDefault();
        savingRef.current = true;
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="flex max-w-3xl flex-col gap-6"
    >
      <input
        type="hidden"
        name="images_json"
        value={JSON.stringify(
          images.map(({ url, kind, width, height }) => ({ url, kind, width, height })),
        )}
      />
      <input type="hidden" name="rating" value={rating ?? ""} />
      <input type="hidden" name="product_id" value={productId ?? ""} />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="customer_name">Nome do cliente</Label>
          <Input
            id="customer_name"
            name="customer_name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="ex.: Carlos Eduardo Mendes"
          />
          {name.trim() && (
            <p className="text-xs text-ink-muted">
              No site aparece como <strong className="text-fg">{formatCustomerName(name)}</strong>.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="customer_location">Cidade/UF (opcional)</Label>
          <Input
            id="customer_location"
            name="customer_location"
            maxLength={60}
            defaultValue={feedback?.customer_location ?? ""}
            placeholder="ex.: Teresina/PI"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="feedback_date">Data do feedback</Label>
          <Input
            id="feedback_date"
            name="feedback_date"
            type="date"
            defaultValue={feedback ? (feedback.feedback_date ?? "") : today()}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Nota (opcional)</Label>
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Nota de 1 a 5 estrelas">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} ${value === 1 ? "estrela" : "estrelas"}`}
                onClick={() => setRating(value)}
                className="flex size-9 items-center justify-center rounded text-warning hover:bg-surface-2"
              >
                <Star className="size-6" fill={rating !== null && value <= rating ? "currentColor" : "none"} />
              </button>
            ))}
            {rating !== null && (
              <button
                type="button"
                onClick={() => setRating(null)}
                className="ml-2 text-xs text-ink-muted underline underline-offset-2 hover:text-fg"
              >
                Sem nota
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="text">Texto (opcional se tiver imagem)</Label>
        <Textarea
          id="text"
          name="text"
          rows={4}
          maxLength={FEEDBACK_TEXT_MAX}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="O que o cliente disse"
        />
        <p className="text-xs text-ink-muted">
          {text.length}/{FEEDBACK_TEXT_MAX}
        </p>
      </div>

      <FeedbackImagesEditor images={images} onChange={setImages} savingRef={savingRef} />
      {empty && (
        <p className="-mt-3 text-xs font-medium text-warning">
          O feedback precisa de um texto ou de pelo menos uma imagem.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label>Produto relacionado (opcional)</Label>
        <div className="flex items-center gap-2">
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={pickerOpen}
                className="w-full max-w-md justify-between font-normal"
              >
                <span className="truncate">{product ? product.name : "Buscar produto pelo nome…"}</span>
                <ChevronsUpDown className="size-4 opacity-60" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
              <Command>
                <CommandInput placeholder="Nome do produto" />
                <CommandList>
                  <CommandEmpty>Nenhum produto com esse nome.</CommandEmpty>
                  {products.map((option) => (
                    <CommandItem
                      key={option.id}
                      value={`${option.name} ${option.id}`}
                      onSelect={() => {
                        setProductId(option.id);
                        setPickerOpen(false);
                      }}
                    >
                      <Check
                        className={`size-4 ${option.id === productId ? "opacity-100" : "opacity-0"}`}
                        aria-hidden="true"
                      />
                      {option.name}
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {product && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setProductId(null)}
              aria-label="Desvincular produto"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-ink-muted">
          Vinculado, o feedback também aparece na página do produto (se estiver ativo).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="position">Ordem</Label>
          <Input
            id="position"
            name="position"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="—"
            defaultValue={feedback?.position ?? ""}
            className="w-28"
          />
          <p className="text-xs text-ink-muted">1 aparece primeiro; sem número, depois (mais recentes primeiro).</p>
        </div>
        <label className="flex items-center gap-3 self-start pt-7">
          <Switch name="active" defaultChecked={feedback?.active ?? true} />
          <span className="text-sm text-fg">Ativo</span>
        </label>
        <label className="flex items-center gap-3 self-start pt-7">
          <Switch name="show_on_home" defaultChecked={feedback?.show_on_home ?? false} />
          <span className="text-sm text-fg">Exibir na home</span>
        </label>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending || empty}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => router.push("/admin/feedbacks")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
