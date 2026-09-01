"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Plus } from "lucide-react";
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
import { InlineCategoryCreator } from "@/components/admin/inline-category-creator";
import {
  VariantEditor,
  type StandardMeasurements,
  type VariantDraft,
} from "@/components/admin/variant-editor";
import { slugify } from "@/lib/format";
import { collectPublishIssues, productSchema, type PublishIssue } from "@/lib/validations/product";
import { useUnsavedChangesGuard, confirmDiscardUnsavedChanges } from "@/lib/hooks/use-unsaved-changes-guard";
import { useDraftAutosave, readDraft, clearDraft } from "@/lib/hooks/use-draft-autosave";
import { duplicateProductAction, type ActionResult } from "@/lib/actions/products";
import type { Category } from "@/lib/data/categories";
import type { ProductStatus } from "@/lib/database.types";
import type { ProductWithRelations } from "@/lib/data/products";

const initialState: ActionResult = { status: "idle" };
const NEW_CATEGORY_VALUE = "__new_category__";

type DraftSnapshot = {
  name: string;
  slug: string;
  description: string;
  price: string;
  compareAtPrice: string;
  categoryId: string;
  status: ProductStatus;
  featured: boolean;
  position: string;
  images: ProductImageDraft[];
  variants: VariantDraft[];
  standardMeasurements: StandardMeasurements;
};

export function ProductForm({
  product,
  categories,
  action,
  initialCategoryId,
  initialStandardMeasurements,
}: {
  product?: ProductWithRelations;
  categories: Category[];
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  initialCategoryId?: string;
  initialStandardMeasurements?: StandardMeasurements;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();
  const draftKey = `king-store:product-draft:${product?.id ?? "new"}`;
  const restoredRef = useRef(false);

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product?.price != null ? String(product.price) : "");
  const [compareAtPrice, setCompareAtPrice] = useState(
    product?.compare_at_price != null ? String(product.compare_at_price) : "",
  );
  const [status, setStatus] = useState(product?.status ?? "draft");
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [position, setPosition] = useState(String(product?.position ?? 0));

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

  const [standardMeasurements, setStandardMeasurements] = useState<StandardMeasurements>(
    initialStandardMeasurements ?? {
      weight_grams: null,
      length_cm: null,
      width_cm: null,
      height_cm: null,
    },
  );

  const [publishIssues, setPublishIssues] = useState<PublishIssue[]>([]);

  const [categoryOptions, setCategoryOptions] = useState<Pick<Category, "id" | "name">[]>(
    categories,
  );
  const [categoryId, setCategoryId] = useState(product?.category_id ?? initialCategoryId ?? "");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state]);

  // ---- unsaved-changes guard + draft autosave --------------------------
  const snapshot: DraftSnapshot = {
    name,
    slug,
    description,
    price,
    compareAtPrice,
    categoryId,
    status,
    featured,
    position,
    images,
    variants,
    standardMeasurements,
  };
  const initialSnapshotRef = useRef<string>(JSON.stringify(snapshot));
  const snapshotStr = JSON.stringify(snapshot);
  const isDirty = snapshotStr !== initialSnapshotRef.current;

  useUnsavedChangesGuard(isDirty);
  useDraftAutosave(draftKey, snapshot, { enabled: isDirty });

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const draft = readDraft<DraftSnapshot>(draftKey);
    if (!draft) return;
    toast("Encontramos um rascunho não salvo desta página.", {
      duration: 15000,
      action: {
        label: "Restaurar",
        onClick: () => {
          const v = draft.value;
          setName(v.name);
          setSlug(v.slug);
          setSlugTouched(true);
          setDescription(v.description);
          setPrice(v.price);
          setCompareAtPrice(v.compareAtPrice);
          setCategoryId(v.categoryId);
          setStatus(v.status);
          setFeatured(v.featured);
          setPosition(v.position);
          setImages(v.images);
          setVariants(v.variants);
          setStandardMeasurements(v.standardMeasurements);
          toast.success("Rascunho restaurado.");
        },
      },
    });
  }, [draftKey]);

  // ---- Ctrl/Cmd+S ------------------------------------------------------
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function applyStandardMeasurements() {
    setVariants((prev) => prev.map((v) => ({ ...v, ...standardMeasurements })));
  }

  function buildValidationCandidate() {
    return {
      name,
      slug,
      description,
      price: price || 0,
      compare_at_price: compareAtPrice || null,
      category_id: categoryId || null,
      status,
      featured,
      position,
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
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const parsed = productSchema.safeParse(buildValidationCandidate());
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
      return;
    }

    // Submission is proceeding — clear the local draft optimistically so
    // a leftover "restore?" prompt doesn't appear after a successful save.
    clearDraft(draftKey);
  }

  async function handleDuplicate() {
    if (!product) return;
    setDuplicating(true);
    const result = await duplicateProductAction(product.id);
    setDuplicating(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Produto duplicado como rascunho.");
    router.push(`/admin/produtos/${result.newId}`);
  }

  function handleCancel() {
    if (!confirmDiscardUnsavedChanges(isDirty)) return;
    router.push("/admin/produtos");
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className="flex max-w-3xl flex-col gap-8"
    >
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
      <input type="hidden" name="std_weight_grams" value={standardMeasurements.weight_grams ?? ""} />
      <input type="hidden" name="std_length_cm" value={standardMeasurements.length_cm ?? ""} />
      <input type="hidden" name="std_width_cm" value={standardMeasurements.width_cm ?? ""} />
      <input type="hidden" name="std_height_cm" value={standardMeasurements.height_cm ?? ""} />

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
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
            value={price}
            onChange={(e) => setPrice(e.target.value)}
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
            value={compareAtPrice}
            onChange={(e) => setCompareAtPrice(e.target.value)}
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
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="rounded-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-8">
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Status</Label>
          <Select
            name="status"
            value={status}
            onValueChange={(value) => setStatus(value as ProductStatus)}
          >
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
          <Switch
            id="featured"
            name="featured"
            checked={featured}
            onCheckedChange={setFeatured}
          />
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

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" name="intent" value="save" size="lg" disabled={pending}>
          {pending ? "Salvando…" : "Salvar produto"}
        </Button>
        <Button
          type="submit"
          name="intent"
          value="save_and_new"
          variant="outline"
          size="lg"
          disabled={pending}
        >
          Salvar e criar outro
        </Button>
        {product && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleDuplicate}
            disabled={duplicating}
          >
            <Copy className="size-4" /> {duplicating ? "Duplicando…" : "Duplicar produto"}
          </Button>
        )}
        <Button type="button" variant="ghost" size="lg" onClick={handleCancel}>
          Cancelar
        </Button>
        <span className="text-xs text-ink-muted">Ctrl/Cmd + S para salvar</span>
      </div>
    </form>
  );
}
