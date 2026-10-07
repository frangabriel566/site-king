"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ImageUploader } from "@/components/admin/image-uploader";
import { SizeGuideEditor } from "@/components/admin/size-guide-editor";
import { slugify } from "@/lib/format";
import type { ActionResult } from "@/lib/actions/categories";
import type { Category } from "@/lib/data/categories";

const initialState: ActionResult = { status: "idle" };

export function CategoryForm({
  category,
  action,
}: {
  category?: Category;
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const [imageUrl, setImageUrl] = useState<string | null>(category?.image_url ?? null);
  const router = useRouter();
  // Set right before a real submit so the uploader keeps the photo this
  // form is about to save — see ImageUploader.
  const savingRef = useRef(false);

  useEffect(() => {
    if (state.status === "error") savingRef.current = false;
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state]);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        savingRef.current = true;
      }}
      className="flex max-w-2xl flex-col gap-6"
    >
      <div className="max-w-xs">
        <ImageUploader
          label="Foto da categoria (opcional)"
          value={imageUrl}
          onChange={setImageUrl}
          folder="categories"
          aspect="aspect-square"
          savingRef={savingRef}
        />
        <input type="hidden" name="image_url" value={imageUrl ?? ""} />
        <p className="mt-2 text-xs text-ink-muted">
          Aparece no círculo da home e no menu do celular, recortada em círculo. Sem
          foto, a loja usa a do primeiro produto da categoria.
        </p>
      </div>

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
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="position">Posição</Label>
        <Input
          id="position"
          name="position"
          type="number"
          min={0}
          defaultValue={category?.position ?? 0}
          className="w-32"
        />
      </div>
      <div className="flex items-center gap-3">
        <Switch id="active" name="active" defaultChecked={category?.active ?? true} />
        <Label htmlFor="active">Ativa</Label>
      </div>

      <SizeGuideEditor initial={category?.size_guide} />

      <div className="mt-2 flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.push("/admin/categorias")}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
