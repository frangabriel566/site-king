"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/admin/image-uploader";
import { slugify } from "@/lib/format";
import type { ActionResult } from "@/lib/actions/brands";
import type { Brand } from "@/lib/data/brands";

const initialState: ActionResult = { status: "idle" };

export function BrandForm({
  brand,
  action,
}: {
  brand?: Brand;
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [name, setName] = useState(brand?.name ?? "");
  const [slug, setSlug] = useState(brand?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(brand));
  const [logoUrl, setLogoUrl] = useState<string | null>(brand?.logo_url ?? null);
  const router = useRouter();
  const savingRef = useRef(false);

  useEffect(() => {
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state]);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        savingRef.current = true;
      }}
      className="flex max-w-md flex-col gap-6"
    >
      <ImageUploader
        label="Logo"
        value={logoUrl}
        onChange={setLogoUrl}
        folder="brand"
        aspect="aspect-square"
        savingRef={savingRef}
      />
      <input type="hidden" name="logo_url" value={logoUrl ?? ""} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nome</Label>
        <Input
          id="name"
          name="name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          className="rounded-none"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          name="slug"
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
          }}
          className="rounded-none"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={brand?.description ?? ""}
          className="rounded-none"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="position">Posição</Label>
        <Input
          id="position"
          name="position"
          type="number"
          min={0}
          defaultValue={brand?.position ?? 0}
          className="w-32 rounded-none"
        />
      </div>
      <div className="flex items-center gap-3">
        <Switch id="active" name="active" defaultChecked={brand?.active ?? true} />
        <Label htmlFor="active">Ativa</Label>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.push("/admin/marcas")}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
