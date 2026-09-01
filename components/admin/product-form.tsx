"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiImageUploader, type ProductImageDraft } from "@/components/admin/multi-image-uploader";
import { VariantEditor, type VariantDraft } from "@/components/admin/variant-editor";
import { slugify } from "@/lib/format";
import type { ActionResult } from "@/lib/actions/products";
import type { Category } from "@/lib/data/categories";
import type { ProductWithRelations } from "@/lib/data/products";

const initialState: ActionResult = { status: "idle" };

export function ProductForm({
  product,
  categories,
  action,
}: {
  product?: ProductWithRelations;
  categories: Category[];
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [images, setImages] = useState<ProductImageDraft[]>(
    (product?.product_images ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((img) => ({ url: img.url, alt: img.alt ?? "" })),
  );
  const [variants, setVariants] = useState<VariantDraft[]>(
    (product?.product_variants ?? []).map((v) => ({
      color: v.color,
      color_hex: v.color_hex ?? "#0A0A0A",
      size: v.size,
      sku: v.sku ?? "",
      stock: v.stock,
    })),
  );

  useEffect(() => {
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-8">
      <input type="hidden" name="slug" value={slug} />
      <input
        type="hidden"
        name="images_json"
        value={JSON.stringify(images)}
      />
      <input
        type="hidden"
        name="variants_json"
        value={JSON.stringify(
          variants.map((v) => ({ ...v, stock: Number(v.stock) || 0 })),
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <Label htmlFor="slug-display">Slug</Label>
          <Input
            id="slug-display"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            className="rounded-none"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={product?.description ?? ""}
          className="rounded-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="price">Preço (R$)</Label>
          <Input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min={0}
            required
            defaultValue={product?.price ?? ""}
            className="rounded-none"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="compare_at_price">Preço &quot;de&quot; (R$)</Label>
          <Input
            id="compare_at_price"
            name="compare_at_price"
            type="number"
            step="0.01"
            min={0}
            defaultValue={product?.compare_at_price ?? ""}
            className="rounded-none"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="category_id">Categoria</Label>
          <Select name="category_id" defaultValue={product?.category_id ?? undefined}>
            <SelectTrigger id="category_id" className="rounded-none">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="position">Posição</Label>
          <Input
            id="position"
            name="position"
            type="number"
            min={0}
            defaultValue={product?.position ?? 0}
            className="rounded-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-8">
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={product?.status ?? "draft"}>
            <SelectTrigger id="status" className="w-40 rounded-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="archived">Arquivado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch id="featured" name="featured" defaultChecked={product?.featured ?? false} />
          <Label htmlFor="featured">Destaque na home</Label>
        </div>
      </div>

      <MultiImageUploader images={images} onChange={setImages} />

      <VariantEditor variants={variants} onChange={setVariants} />

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Salvando…" : "Salvar produto"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.push("/admin/produtos")}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
