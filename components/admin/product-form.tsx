"use client";

import { useActionState, useEffect, useState, type FormEvent } from "react";
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
import { Plus } from "lucide-react";
import { MultiImageUploader, type ProductImageDraft } from "@/components/admin/multi-image-uploader";
import { InlineCategoryCreator } from "@/components/admin/inline-category-creator";
import {
  VariantEditor,
  type StandardMeasurements,
  type VariantDraft,
} from "@/components/admin/variant-editor";
import { slugify } from "@/lib/format";
import { collectPublishIssues, productSchema, type PublishIssue } from "@/lib/validations/product";
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
  const [variants, setVariants] = useState<VariantDraft[]>(() =>
    (product?.product_variants ?? []).map((v) => ({
      clientId: v.id,
      color: v.color,
      color_hex: v.color_hex ?? "",
      size: v.size,
      sku: v.sku ?? "",
      skuManual: true, // existing variants keep their saved SKU as-is until touched
      stock: v.stock,
      weight_grams: v.weight_grams,
      length_cm: v.length_cm,
      width_cm: v.width_cm,
      height_cm: v.height_cm,
    })),
  );

  const [standardMeasurements, setStandardMeasurements] = useState<StandardMeasurements>({
    weight_grams: null,
    length_cm: null,
    width_cm: null,
    height_cm: null,
  });

  const [publishIssues, setPublishIssues] = useState<PublishIssue[]>([]);

  const [categoryOptions, setCategoryOptions] = useState<Pick<Category, "id" | "name">[]>(
    categories,
  );
  const [categoryId, setCategoryId] = useState(product?.category_id ?? "");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const NEW_CATEGORY_VALUE = "__new_category__";

  useEffect(() => {
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state]);

  function applyStandardMeasurements() {
    setVariants((prev) => prev.map((v) => ({ ...v, ...standardMeasurements })));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const candidate = {
      name: formData.get("name"),
      slug: formData.get("slug"),
      description: formData.get("description"),
      price: formData.get("price") || 0,
      compare_at_price: formData.get("compare_at_price") || null,
      category_id: formData.get("category_id") || null,
      status: formData.get("status"),
      featured: formData.get("featured") === "on",
      position: formData.get("position"),
      images,
      variants: variants.map((v) => ({
        color: v.color,
        color_hex: v.color_hex,
        size: v.size,
        sku: v.sku,
        stock: v.stock,
        weight_grams: v.weight_grams,
        length_cm: v.length_cm,
        width_cm: v.width_cm,
        height_cm: v.height_cm,
      })),
    };

    const parsed = productSchema.safeParse(candidate);
    if (!parsed.success) {
      // Basic shape errors (bad slug, etc.) surface via the server's toast
      // as before — the publish gate only concerns itself with
      // publish-readiness, not field formatting.
      setPublishIssues([]);
      return;
    }

    const issues = collectPublishIssues(parsed.data);
    setPublishIssues(issues);
    if (issues.length > 0) {
      event.preventDefault();
      toast.error("Faltam informações para publicar este produto.");
      requestAnimationFrame(() => {
        document.getElementById("publish-issues")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="flex max-w-3xl flex-col gap-8">
      {publishIssues.length > 0 && (
        <div
          id="publish-issues"
          role="alert"
          className="scroll-mt-24 border border-[var(--danger)] bg-[var(--danger)]/10 p-4"
        >
          <p className="mb-2 text-sm font-medium text-[var(--danger)]">
            Não é possível publicar — falta o seguinte:
          </p>
          <ul className="flex flex-col gap-1">
            {publishIssues.map((issue) => (
              <li key={issue.anchor + issue.message}>
                <a
                  href={`#${issue.anchor}`}
                  className="text-sm text-[var(--danger)] underline underline-offset-4 hover:opacity-80"
                >
                  {issue.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="images_json" value={JSON.stringify(images)} />
      <input
        type="hidden"
        name="variants_json"
        value={JSON.stringify(
          variants.map((v) => ({
            color: v.color,
            color_hex: v.color_hex,
            size: v.size,
            sku: v.sku,
            stock: Number(v.stock) || 0,
            weight_grams: v.weight_grams,
            length_cm: v.length_cm,
            width_cm: v.width_cm,
            height_cm: v.height_cm,
          })),
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

      <div id="field-description" className="flex scroll-mt-24 flex-col gap-2">
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
        <div id="field-price" className="scroll-mt-24 flex flex-col gap-2">
          <Label htmlFor="price">Preço (R$)</Label>
          <Input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min={0}
            defaultValue={product?.price ?? ""}
            className="rounded-none"
          />
          <p className="text-xs text-ink-muted">Pode ficar em branco enquanto é rascunho.</p>
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
        <div id="field-category" className="scroll-mt-24 flex flex-col gap-2">
          <Label htmlFor="category_id">Categoria</Label>
          <Select
            name="category_id"
            value={categoryId}
            onValueChange={(value) => {
              if (value === NEW_CATEGORY_VALUE) {
                setCategoryDialogOpen(true);
                return;
              }
              setCategoryId(value);
            }}
          >
            <SelectTrigger id="category_id" className="rounded-none">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              {categoryOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
              <SelectItem value={NEW_CATEGORY_VALUE} className="!text-gold">
                <Plus className="size-3.5" /> Criar nova categoria
              </SelectItem>
            </SelectContent>
          </Select>
          <InlineCategoryCreator
            open={categoryDialogOpen}
            onOpenChange={setCategoryDialogOpen}
            onCreated={(category) => {
              setCategoryOptions((prev) => [...prev, category]);
              setCategoryId(category.id);
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

      <div id="field-images" className="scroll-mt-24">
        <MultiImageUploader images={images} onChange={setImages} />
      </div>

      <div id="field-measurements" className="scroll-mt-24 border border-dashed border-line p-4">
        <p className="text-label mb-3">Medidas padrão do produto</p>
        <p className="mb-4 text-xs text-ink-muted">
          Preenche peso e dimensões de todas as variações de uma vez — dá
          para sobrescrever individualmente na grade abaixo.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="std-weight">Peso (g)</Label>
            <Input
              id="std-weight"
              type="number"
              min={0}
              value={standardMeasurements.weight_grams ?? ""}
              onChange={(e) =>
                setStandardMeasurements((prev) => ({
                  ...prev,
                  weight_grams: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="rounded-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="std-length">Comprimento (cm)</Label>
            <Input
              id="std-length"
              type="number"
              min={0}
              step="0.1"
              value={standardMeasurements.length_cm ?? ""}
              onChange={(e) =>
                setStandardMeasurements((prev) => ({
                  ...prev,
                  length_cm: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="rounded-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="std-width">Largura (cm)</Label>
            <Input
              id="std-width"
              type="number"
              min={0}
              step="0.1"
              value={standardMeasurements.width_cm ?? ""}
              onChange={(e) =>
                setStandardMeasurements((prev) => ({
                  ...prev,
                  width_cm: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="rounded-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="std-height">Altura (cm)</Label>
            <Input
              id="std-height"
              type="number"
              min={0}
              step="0.1"
              value={standardMeasurements.height_cm ?? ""}
              onChange={(e) =>
                setStandardMeasurements((prev) => ({
                  ...prev,
                  height_cm: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="rounded-none"
            />
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={applyStandardMeasurements}
          disabled={variants.length === 0}
        >
          Aplicar a todas as variações
        </Button>
      </div>

      <VariantEditor
        productSlug={slug}
        variants={variants}
        onChange={setVariants}
        standardMeasurements={standardMeasurements}
      />

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
