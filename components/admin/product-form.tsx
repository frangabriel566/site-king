"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type FocusEvent as ReactFocusEvent,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Plus, X } from "lucide-react";
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
import { InlineBrandCreator } from "@/components/admin/inline-brand-creator";
import { AttributesEditor, type AttributeRow } from "@/components/admin/attributes-editor";
import { VariantEditor, type VariantDraft } from "@/components/admin/variant-editor";
import { slugify } from "@/lib/format";
import { SIMPLE_VARIANT_COLOR, SIMPLE_VARIANT_SIZE, isSimpleVariant } from "@/lib/constants";
import { collectPublishIssues, productSchema, type PublishIssue } from "@/lib/validations/product";
import { useUnsavedChangesGuard, confirmDiscardUnsavedChanges } from "@/lib/hooks/use-unsaved-changes-guard";
import { useDraftAutosave, readDraft, clearDraft } from "@/lib/hooks/use-draft-autosave";
import { deleteMediaAction } from "@/lib/actions/media";
import { duplicateProductAction, type ActionResult } from "@/lib/actions/products";
import type { Category } from "@/lib/data/categories";
import type { AdminBrandListItem } from "@/lib/data/brands";
import type { ProductStatus, ProductBadge } from "@/lib/database.types";
import type { ProductWithRelations } from "@/lib/data/products";

const initialState: ActionResult = { status: "idle" };
const NEW_CATEGORY_VALUE = "__new_category__";
const NEW_BRAND_VALUE = "__new_brand__";
const NO_BRAND_VALUE = "__no_brand__";
const NO_BADGE_VALUE = "__no_badge__";
const PLACEMENT_OPTIONS: { value: string; label: string }[] = [
  { value: NO_BADGE_VALUE, label: "Produtos" },
  { value: "lancamento", label: "Lançamentos" },
  { value: "mais_vendido", label: "Mais vendidos" },
  { value: "oferta", label: "Ofertas" },
];

/** Selects the field's full text on focus so typing a new number always
 * replaces it — see the identical helper in variant-editor.tsx for why
 * this matters for number inputs specifically. */
function selectOnFocus(e: ReactFocusEvent<HTMLInputElement>) {
  e.target.select();
}

function newClientId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function attributesToRows(attributes: unknown): AttributeRow[] {
  if (!attributes || typeof attributes !== "object") return [];
  return Object.entries(attributes as Record<string, unknown>).map(([key, value]) => ({
    key,
    value: String(value ?? ""),
  }));
}

function rowsToAttributes(rows: AttributeRow[]): Record<string, string> | null {
  const entries = rows
    .map((row) => [row.key.trim(), row.value.trim()] as const)
    .filter(([key]) => key.length > 0);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function isSimpleVariantSet(variants: VariantDraft[]): boolean {
  return variants.length === 1 && isSimpleVariant(variants[0].color, variants[0].size);
}

type SectionProps = { title: string; description?: string; children: React.ReactNode; id?: string };

function FormSection({ title, description, children, id }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line pt-8 first:border-t-0 first:pt-0">
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      {description && <p className="mt-1 text-xs text-ink-muted">{description}</p>}
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  );
}

type DraftSnapshot = {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  videoUrl: string;
  tags: string[];
  collection: string;
  shippingNote: string;
  exchangeInfo: string;
  careInstructions: string;
  price: string;
  compareAtPrice: string;
  categoryId: string;
  brandId: string;
  manufacturerRef: string;
  badge: string;
  attributeRows: AttributeRow[];
  status: ProductStatus;
  featured: boolean;
  position: string;
  images: ProductImageDraft[];
  variants: VariantDraft[];
  noVariants: boolean;
};

export function ProductForm({
  product,
  categories,
  brands,
  action,
  initialCategoryId,
  initialBrandId,
}: {
  product?: ProductWithRelations;
  categories: Category[];
  brands: AdminBrandListItem[];
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  initialCategoryId?: string;
  initialBrandId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();
  const draftKey = `king-store:product-draft:${product?.id ?? "new"}`;
  const restoredRef = useRef(false);

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [shortDescription, setShortDescription] = useState(product?.short_description ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(product?.video_url ?? "");
  const [tags, setTags] = useState<string[]>(product?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [collection, setCollection] = useState(product?.collection ?? "");
  const [shippingNote, setShippingNote] = useState(product?.shipping_note ?? "");
  const [exchangeInfo, setExchangeInfo] = useState(product?.exchange_info ?? "");
  const [careInstructions, setCareInstructions] = useState(product?.care_instructions ?? "");
  const [price, setPrice] = useState(product?.price != null ? String(product.price) : "");
  const [compareAtPrice, setCompareAtPrice] = useState(
    product?.compare_at_price != null ? String(product.compare_at_price) : "",
  );
  const [pricingMode, setPricingMode] = useState<"normal" | "oferta">(
    product?.compare_at_price != null ? "oferta" : "normal",
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
  const initialVariants: VariantDraft[] = (product?.product_variants ?? []).map((v) => ({
    clientId: v.id,
    color: v.color,
    color_hex: v.color_hex ?? "",
    size: v.size,
    sku: v.sku ?? "",
    skuManual: true, // existing variants keep their saved SKU as-is until touched
    stock: v.stock,
    image_url: v.image_url ?? "",
  }));
  const [variants, setVariants] = useState<VariantDraft[]>(initialVariants);
  const [noVariants, setNoVariants] = useState(
    product ? isSimpleVariantSet(initialVariants) : false,
  );

  const [publishIssues, setPublishIssues] = useState<PublishIssue[]>([]);

  const [categoryOptions, setCategoryOptions] = useState<Pick<Category, "id" | "name">[]>(
    categories,
  );
  const [categoryId, setCategoryId] = useState(product?.category_id ?? initialCategoryId ?? "");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const selectedCategoryName = categoryOptions.find((c) => c.id === categoryId)?.name ?? "";
  const isShoeCategory = /t[eê]nis|chinelo|sand[aá]lia/i.test(selectedCategoryName);

  const [brandOptions, setBrandOptions] = useState<Pick<AdminBrandListItem, "id" | "name">[]>(
    brands,
  );
  const [brandId, setBrandId] = useState(product?.brand_id ?? initialBrandId ?? "");
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [manufacturerRef, setManufacturerRef] = useState(product?.manufacturer_ref ?? "");
  const [badge, setBadge] = useState<string>(product?.badge ?? "");
  const [attributeRows, setAttributeRows] = useState<AttributeRow[]>(
    attributesToRows(product?.attributes),
  );

  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state]);

  // ---- "produto sem variações" toggle -----------------------------------
  function toggleNoVariants(checked: boolean) {
    setNoVariants(checked);
    if (checked) {
      setVariants((prev) => [
        {
          clientId: prev[0]?.clientId ?? newClientId(),
          color: SIMPLE_VARIANT_COLOR,
          color_hex: "",
          size: SIMPLE_VARIANT_SIZE,
          sku: prev[0]?.sku ?? "",
          skuManual: true,
          stock: prev[0]?.stock ?? 0,
          image_url: "",
        },
      ]);
    } else {
      setVariants([]);
    }
  }

  const simpleSku = variants[0]?.sku ?? "";
  const simpleStock = variants[0]?.stock ?? 0;
  function setSimpleSku(value: string) {
    setVariants((prev) => [{ ...(prev[0] ?? makeSimpleRow()), sku: value, skuManual: true }]);
  }
  function setSimpleStock(value: number) {
    setVariants((prev) => [{ ...(prev[0] ?? makeSimpleRow()), stock: value }]);
  }
  function makeSimpleRow(): VariantDraft {
    return {
      clientId: newClientId(),
      color: SIMPLE_VARIANT_COLOR,
      color_hex: "",
      size: SIMPLE_VARIANT_SIZE,
      sku: "",
      skuManual: true,
      stock: 0,
      image_url: "",
    };
  }

  // ---- tags ---------------------------------------------------------------
  function addTag(raw: string) {
    const value = raw.trim();
    if (!value || tags.includes(value)) return;
    setTags((prev) => [...prev, value]);
  }
  function handleTagKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
      setTagInput("");
    } else if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  // ---- unsaved-changes guard + draft autosave --------------------------
  const snapshot: DraftSnapshot = {
    name,
    slug,
    shortDescription,
    description,
    videoUrl,
    tags,
    collection,
    shippingNote,
    exchangeInfo,
    careInstructions,
    price,
    compareAtPrice,
    categoryId,
    brandId,
    manufacturerRef,
    badge,
    attributeRows,
    status,
    featured,
    position,
    images,
    variants,
    noVariants,
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
          setShortDescription(v.shortDescription ?? "");
          setDescription(v.description);
          setVideoUrl(v.videoUrl ?? "");
          setTags(v.tags ?? []);
          setCollection(v.collection ?? "");
          setShippingNote(v.shippingNote ?? "");
          setExchangeInfo(v.exchangeInfo ?? "");
          setCareInstructions(v.careInstructions ?? "");
          setPrice(v.price);
          setCompareAtPrice(v.compareAtPrice);
          setPricingMode(v.compareAtPrice ? "oferta" : "normal");
          setCategoryId(v.categoryId);
          setBrandId(v.brandId ?? "");
          setManufacturerRef(v.manufacturerRef ?? "");
          setBadge(v.badge ?? "");
          setAttributeRows(v.attributeRows ?? []);
          setStatus(v.status);
          setFeatured(v.featured);
          setPosition(v.position);
          setImages(v.images);
          setVariants(v.variants);
          setNoVariants(v.noVariants ?? isSimpleVariantSet(v.variants));
          toast.success("Rascunho restaurado.");
        },
      },
    });
  }, [draftKey]);

  // ---- orphaned-upload cleanup ------------------------------------------
  // Images the operator uploaded this session but never actually saved
  // (abandoned edit, closed tab via in-app nav) shouldn't linger in
  // Storage. `savingRef` is flipped right before a real submit so a
  // *successful* save — which also unmounts this form via redirect()
  // — doesn't trigger the same cleanup on the images it just persisted.
  const savingRef = useRef(false);
  const imagesRef = useRef(images);
  imagesRef.current = images;
  useEffect(() => {
    return () => {
      if (savingRef.current) return;
      for (const image of imagesRef.current) {
        if (image.isNew) void deleteMediaAction(image.url);
      }
    };
  }, []);
  useEffect(() => {
    // A failed save keeps the form mounted — allow cleanup again if the
    // operator abandons the page after that.
    if (state.status === "error") savingRef.current = false;
  }, [state]);

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

  function buildValidationCandidate() {
    return {
      name,
      slug,
      short_description: shortDescription,
      description,
      video_url: videoUrl,
      tags,
      collection,
      shipping_note: shippingNote,
      exchange_info: exchangeInfo,
      care_instructions: careInstructions,
      price: price || 0,
      compare_at_price: compareAtPrice || null,
      category_id: categoryId || null,
      brand_id: brandId || null,
      manufacturer_ref: manufacturerRef,
      attributes: rowsToAttributes(attributeRows),
      badge: (badge || null) as ProductBadge | null,
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
        image_url: v.image_url,
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
    // a leftover "restore?" prompt doesn't appear after a successful save,
    // and suppress the orphaned-upload cleanup below since these images
    // are about to become real.
    clearDraft(draftKey);
    savingRef.current = true;
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
            image_url: v.image_url,
          })),
        )}
      />
      <input type="hidden" name="brand_id" value={brandId} />
      <input type="hidden" name="manufacturer_ref" value={manufacturerRef} />
      <input type="hidden" name="badge" value={badge} />
      <input
        type="hidden"
        name="attributes_json"
        value={JSON.stringify(rowsToAttributes(attributeRows))}
      />
      <input type="hidden" name="tags_json" value={JSON.stringify(tags)} />

      {/* 1. Informações do produto */}
      <FormSection title="1. Informações do produto">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nome do produto</Label>
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
          <Label htmlFor="short_description">Descrição curta</Label>
          <Input
            id="short_description"
            name="short_description"
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            placeholder="Uma linha para o topo da página do produto"
            maxLength={300}
            className="rounded-none"
          />
        </div>

        <div id="field-description" className="flex scroll-mt-24 flex-col gap-2">
          <Label htmlFor="description">Descrição completa</Label>
          <Textarea
            id="description"
            name="description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-none"
          />
        </div>
      </FormSection>

      {/* 2. Fotos e mídia */}
      <FormSection title="2. Fotos e mídia">
        <div id="field-images" className="scroll-mt-24">
          <MultiImageUploader images={images} onChange={setImages} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="video_url">Vídeo do produto (opcional)</Label>
          <Input
            id="video_url"
            name="video_url"
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Link do YouTube, Vimeo ou arquivo .mp4"
            className="rounded-none"
          />
        </div>
      </FormSection>

      {/* 3. Preço */}
      <FormSection title="3. Preço">
        <div className="flex flex-col gap-2">
          <Label>Tipo de preço</Label>
          <div className="grid w-fit grid-cols-2 gap-2">
            {(
              [
                { value: "normal", label: "Preço normal" },
                { value: "oferta", label: "Oferta" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setPricingMode(option.value);
                  if (option.value === "normal") setCompareAtPrice("");
                }}
                aria-pressed={pricingMode === option.value}
                className={`flex h-10 items-center justify-center border px-4 text-sm font-medium transition-colors duration-150 ease-out ${
                  pricingMode === option.value
                    ? "border-fg bg-fg text-bg"
                    : "border-line text-ink-muted hover:border-ink-muted"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-muted">
            Em &quot;Oferta&quot;, o preço original aparece riscado na loja e o
            preço de venda vira o preço com desconto — precisa ser menor que o
            original.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div id="field-price" className="scroll-mt-24 flex flex-col gap-2">
            <Label htmlFor="price">
              {pricingMode === "oferta" ? "Preço com desconto (R$)" : "Preço de venda (R$)"}
            </Label>
            <Input
              id="price"
              name="price"
              type="number"
              step="0.01"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onFocus={selectOnFocus}
              className="rounded-none"
            />
            <p className="text-xs text-ink-muted">Pode ficar em branco enquanto é rascunho.</p>
          </div>
          {pricingMode === "oferta" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="compare_at_price">Preço original &quot;de&quot; (R$)</Label>
              <Input
                id="compare_at_price"
                name="compare_at_price"
                type="number"
                step="0.01"
                min={0}
                value={compareAtPrice}
                onChange={(e) => setCompareAtPrice(e.target.value)}
                onFocus={selectOnFocus}
                className="rounded-none"
              />
              {compareAtPrice !== "" &&
                price !== "" &&
                Number(compareAtPrice) <= Number(price) && (
                  <p className="text-xs text-alert">
                    Deve ser maior que o preço com desconto.
                  </p>
                )}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="position">Posição</Label>
            <Input
              id="position"
              name="position"
              type="number"
              min={0}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              onFocus={selectOnFocus}
              className="rounded-none"
            />
          </div>
        </div>
      </FormSection>

      {/* 4 + 5. Cores e tamanhos / Estoque e variações */}
      <FormSection
        id="field-variants"
        title="4. Cores e tamanhos"
        description="Gere as combinações de cor e tamanho — o estoque de cada uma fica na seção seguinte."
      >
        <label className="flex items-center gap-2.5">
          <Switch checked={noVariants} onCheckedChange={toggleNoVariants} />
          <span className="text-sm text-fg">
            Produto sem variações (um único SKU e estoque, sem cor/tamanho)
          </span>
        </label>

        {!noVariants && (
          <VariantEditor
            productSlug={slug}
            variants={variants}
            onChange={setVariants}
            isShoeCategory={isShoeCategory}
          />
        )}
      </FormSection>

      <FormSection title="5. Estoque e variações">
        {noVariants ? (
          <div className="grid grid-cols-2 gap-4 sm:w-96">
            <div className="flex flex-col gap-2">
              <Label htmlFor="simple-sku">SKU</Label>
              <Input
                id="simple-sku"
                value={simpleSku}
                onChange={(e) => setSimpleSku(e.target.value)}
                placeholder={slug ? slug.toUpperCase() : "SKU"}
                className="rounded-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="simple-stock">Estoque</Label>
              <Input
                id="simple-stock"
                type="number"
                min={0}
                value={simpleStock}
                onChange={(e) => setSimpleStock(Number(e.target.value) || 0)}
                onFocus={selectOnFocus}
                className="rounded-none"
              />
            </div>
          </div>
        ) : (
          <p className="text-xs text-ink-muted">
            O estoque de cada variação é definido na seção &quot;Cores e
            tamanhos&quot; acima, na tabela de cada cor.
          </p>
        )}
      </FormSection>

      {/* 6. Organização do produto */}
      <FormSection title="6. Organização do produto">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div id="field-category" className="scroll-mt-24 flex flex-col gap-2">
            <Label htmlFor="category_id">Categoria</Label>
            <Select
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
            <input type="hidden" name="category_id" value={categoryId} />
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
            <Label htmlFor="brand_id">Marca</Label>
            <Select
              value={brandId || NO_BRAND_VALUE}
              onValueChange={(value) => {
                if (value === NEW_BRAND_VALUE) {
                  setBrandDialogOpen(true);
                  return;
                }
                setBrandId(value === NO_BRAND_VALUE ? "" : value);
              }}
            >
              <SelectTrigger id="brand_id" className="rounded-none">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value={NO_BRAND_VALUE}>Sem marca</SelectItem>
                {brandOptions.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_BRAND_VALUE} className="!text-gold">
                  <Plus className="size-3.5" /> Criar nova marca
                </SelectItem>
              </SelectContent>
            </Select>
            <InlineBrandCreator
              open={brandDialogOpen}
              onOpenChange={setBrandDialogOpen}
              onCreated={(brand) => {
                setBrandOptions((prev) => [...prev, brand]);
                setBrandId(brand.id);
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="collection">Coleção</Label>
            <Input
              id="collection"
              name="collection"
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
              placeholder="Ex: Verão 2026"
              className="rounded-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="manufacturer_ref-display">Referência do fabricante</Label>
            <Input
              id="manufacturer_ref-display"
              value={manufacturerRef}
              onChange={(e) => setManufacturerRef(e.target.value)}
              className="rounded-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="status">Produto ativo no site</Label>
            <Select
              name="status"
              value={status}
              onValueChange={(value) => setStatus(value as ProductStatus)}
            >
              <SelectTrigger id="status" className="rounded-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="draft">Não — rascunho</SelectItem>
                <SelectItem value="active">Sim — ativo</SelectItem>
                <SelectItem value="archived">Não — arquivado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Onde aparece no site</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PLACEMENT_OPTIONS.map((option) => {
              const isActive = (badge || NO_BADGE_VALUE) === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setBadge(option.value === NO_BADGE_VALUE ? "" : option.value)
                  }
                  aria-pressed={isActive}
                  className={`flex h-10 items-center justify-center border px-2 text-sm font-medium transition-colors duration-150 ease-out ${
                    isActive
                      ? "border-fg bg-fg text-bg"
                      : "border-line text-ink-muted hover:border-ink-muted"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-ink-muted">
            Define em qual vitrine da home o produto aparece. &quot;Produtos&quot; é o
            catálogo padrão — as outras três são as seções de destaque.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="tag-input">Tags</Label>
          <div className="flex flex-wrap items-center gap-2 border border-line p-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 bg-[#1a1a1a] px-2 py-1 text-xs text-fg"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                  aria-label={`Remover tag ${tag}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <input
              id="tag-input"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={() => {
                addTag(tagInput);
                setTagInput("");
              }}
              placeholder={tags.length === 0 ? "Digite e pressione Enter" : ""}
              className="min-w-32 flex-1 bg-transparent px-1 py-1 text-sm outline-none"
            />
          </div>
        </div>

        <AttributesEditor rows={attributeRows} onChange={setAttributeRows} />

        <div className="flex items-center gap-3">
          <Switch id="featured" name="featured" checked={featured} onCheckedChange={setFeatured} />
          <Label htmlFor="featured">Produto em destaque na home</Label>
        </div>
      </FormSection>

      {/* 7. Envio, troca e cuidados */}
      <FormSection title="7. Envio, troca e cuidados">
        <div className="flex flex-col gap-2">
          <Label htmlFor="shipping_note">Prazo de envio</Label>
          <Input
            id="shipping_note"
            name="shipping_note"
            value={shippingNote}
            onChange={(e) => setShippingNote(e.target.value)}
            placeholder="Ex: Envio em até 2 dias úteis (deixe em branco para usar o padrão da loja)"
            className="rounded-none"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="exchange_info">Informações de troca</Label>
          <Textarea
            id="exchange_info"
            name="exchange_info"
            rows={2}
            value={exchangeInfo}
            onChange={(e) => setExchangeInfo(e.target.value)}
            placeholder="Deixe em branco para usar a política padrão da loja"
            className="rounded-none"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="care_instructions">Cuidados com a peça</Label>
          <Textarea
            id="care_instructions"
            name="care_instructions"
            rows={2}
            value={careInstructions}
            onChange={(e) => setCareInstructions(e.target.value)}
            placeholder="Ex: Lavar à mão, não usar alvejante"
            className="rounded-none"
          />
        </div>
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-8">
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
