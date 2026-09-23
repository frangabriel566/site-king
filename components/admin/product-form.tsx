"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ProductFormSection } from "@/components/admin/product-form-section";
import { ProductBasicInfo } from "@/components/admin/product-basic-info";
import { MultiImageUploader, type ProductImageDraft } from "@/components/admin/multi-image-uploader";
import { ProductVariantsEditor } from "@/components/admin/product-variants-editor";
import { ProductDisplaySettings } from "@/components/admin/product-display-settings";
import { ProductAdvancedSettings } from "@/components/admin/product-advanced-settings";
import {
  ProductPackageFields,
  type PackageDraft,
} from "@/components/admin/product-package-fields";
import { ProductFormActionBar } from "@/components/admin/product-form-action-bar";
import { type AttributeRow } from "@/components/admin/attributes-editor";
import { slugify } from "@/lib/format";
import {
  buildSimpleVariant,
  colorsFromVariants,
  countVariants,
  deriveVariants,
  detectVariantMode,
  makeColorlessColor,
  type ColorDraft,
  type VariantMode,
} from "@/lib/variants";
import { collectPublishIssues, productSchema, type PublishIssue } from "@/lib/validations/product";
import {
  useUnsavedChangesGuard,
  confirmDiscardUnsavedChanges,
} from "@/lib/hooks/use-unsaved-changes-guard";
import { useDraftAutosave, readDraft, clearDraft } from "@/lib/hooks/use-draft-autosave";
import { usePhotoDedupRegistry } from "@/lib/hooks/use-photo-dedup-registry";
import { deleteMediaAction } from "@/lib/actions/media";
import { duplicateProductAction, type ActionResult } from "@/lib/actions/products";
import type { Category } from "@/lib/data/categories";
import type { AdminBrandListItem } from "@/lib/data/brands";
import type { ProductStatus, ProductBadge } from "@/lib/database.types";
import type { ProductWithRelations } from "@/lib/data/products";

const initialState: ActionResult = { status: "idle" };

/** Publish issues that live inside the collapsed advanced panel — failing
 * on one has to open it, or the operator is sent to an invisible field. */
const ADVANCED_ANCHORS = new Set(["field-description"]);

/** The slug as typed when it is free, otherwise the first "-2", "-3"… that
 * nobody is using. Empty stays empty: an unnamed product has no address
 * yet, and suffixing nothing would produce a bare "-2". */
function freeSlug(base: string, taken: Set<string>): string {
  if (!base || !taken.has(base)) return base;
  let attempt = 2;
  while (taken.has(`${base}-${attempt}`)) attempt += 1;
  return `${base}-${attempt}`;
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
  promoEnabled: boolean;
  categoryId: string;
  brandId: string;
  manufacturerRef: string;
  badge: string;
  attributeRows: AttributeRow[];
  status: ProductStatus;
  featured: boolean;
  position: string;
  images: ProductImageDraft[];
  mode: VariantMode;
  colors: ColorDraft[];
  sizeOnly: ColorDraft;
  simpleSku: string;
  simpleStock: number;
};

export function ProductForm({
  product,
  categories,
  brands,
  action,
  initialCategoryId,
  initialBrandId,
  existingSkus = [],
  existingSlugs = [],
}: {
  product?: ProductWithRelations;
  categories: Category[];
  brands: AdminBrandListItem[];
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  initialCategoryId?: string;
  initialBrandId?: string;
  /** Every SKU already saved on another product — lets the generator
   * avoid colliding with them instead of only finding out at save time. */
  existingSkus?: string[];
  /** Slugs already taken by other products. products.slug is unique, so a
   * repeat is refused by the database — the form settles on a free one
   * while the operator types instead of failing at save. */
  existingSlugs?: string[];
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();
  // v3: the editor models colourways and a selling mode, not flat variant
  // rows — a draft written by an older form can't be restored into this
  // shape, so the key changes with it rather than half-restoring.
  const draftKey = `king-store:product-draft-v3:${product?.id ?? "new"}`;
  const restoredRef = useRef(false);
  const { checkAndRegister: checkDuplicatePhoto } = usePhotoDedupRegistry();

  const savedVariants = product?.product_variants ?? [];
  // A new product starts on "só tamanhos": the common case here is one
  // photo and a size run, and starting on "cores" would make that product
  // ask for a colour name it doesn't have. Editing an existing product
  // always opens in the mode it was actually built in.
  const savedMode = product ? detectVariantMode(savedVariants) : "sizes";
  const savedColors = colorsFromVariants(savedVariants);

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [shortDescription, setShortDescription] = useState(product?.short_description ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(product?.video_url ?? "");
  const [tags, setTags] = useState<string[]>(product?.tags ?? []);
  const [collection, setCollection] = useState(product?.collection ?? "");
  const [shippingNote, setShippingNote] = useState(product?.shipping_note ?? "");
  const [exchangeInfo, setExchangeInfo] = useState(product?.exchange_info ?? "");
  const [careInstructions, setCareInstructions] = useState(product?.care_instructions ?? "");
  const [price, setPrice] = useState(product?.price != null ? String(product.price) : "");
  const [compareAtPrice, setCompareAtPrice] = useState(
    product?.compare_at_price != null ? String(product.compare_at_price) : "",
  );
  const [promoEnabled, setPromoEnabled] = useState(product?.compare_at_price != null);
  const [status, setStatus] = useState<ProductStatus>(product?.status ?? "draft");
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [position, setPosition] = useState(String(product?.position ?? 0));
  const [pkg, setPkg] = useState<PackageDraft>({
    weightGrams: product?.weight_grams != null ? String(product.weight_grams) : "",
    lengthCm: product?.length_cm != null ? String(product.length_cm) : "",
    widthCm: product?.width_cm != null ? String(product.width_cm) : "",
    heightCm: product?.height_cm != null ? String(product.height_cm) : "",
  });
  // "" and "abc" both have to reach the schema as null, not NaN: the
  // publish gate reports a missing measurement, coercion would report a
  // type error the operator cannot act on.
  const pkgNumber = (raw: string): number | null => {
    const parsed = Number.parseFloat(raw.replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const [images, setImages] = useState<ProductImageDraft[]>(
    (product?.product_images ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((img) => ({ url: img.url, alt: img.alt ?? "" })),
  );

  const [mode, setMode] = useState<VariantMode>(savedMode);
  const [colors, setColors] = useState<ColorDraft[]>(savedMode === "colors" ? savedColors : []);
  // The one unnamed colourway behind "só tamanhos", kept apart from
  // `colors` so switching modes never discards either side's work.
  const [sizeOnly, setSizeOnly] = useState<ColorDraft>(() =>
    savedMode === "sizes" && savedColors[0] ? savedColors[0] : makeColorlessColor(),
  );
  const [simpleSku, setSimpleSku] = useState(
    savedMode === "single" ? (savedVariants[0].sku ?? "") : "",
  );
  const [simpleStock, setSimpleStock] = useState(
    savedMode === "single" ? savedVariants[0].stock : 0,
  );

  const takenSlugs = useMemo(() => new Set(existingSlugs), [existingSlugs]);
  const slugTaken = slug !== "" && takenSlugs.has(slug);

  const [publishIssues, setPublishIssues] = useState<PublishIssue[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [categoryOptions, setCategoryOptions] = useState<Pick<Category, "id" | "name">[]>(categories);
  const [categoryId, setCategoryId] = useState(product?.category_id ?? initialCategoryId ?? "");
  const selectedCategoryName = categoryOptions.find((c) => c.id === categoryId)?.name ?? "";
  const isShoeCategory = /t[eê]nis|chinelo|sand[aá]lia/i.test(selectedCategoryName);

  const [brandOptions, setBrandOptions] = useState<Pick<AdminBrandListItem, "id" | "name">[]>(brands);
  const [brandId, setBrandId] = useState(product?.brand_id ?? initialBrandId ?? "");
  const [manufacturerRef, setManufacturerRef] = useState(product?.manufacturer_ref ?? "");
  const [badge, setBadge] = useState<string>(product?.badge ?? "");
  const [attributeRows, setAttributeRows] = useState<AttributeRow[]>(
    attributesToRows(product?.attributes),
  );

  const [duplicating, setDuplicating] = useState(false);

  // The rows the backend actually stores. Generated SKUs are (re)derived
  // here rather than frozen at creation time, so naming the product after
  // picking its colors still yields SLUG-COR-TAMANHO.
  const variants = useMemo(() => {
    if (mode === "single") {
      return [buildSimpleVariant(slug, simpleSku, simpleStock, existingSkus)];
    }
    return deriveVariants(mode === "sizes" ? [sizeOnly] : colors, slug, existingSkus);
  }, [mode, slug, simpleSku, simpleStock, sizeOnly, colors, existingSkus]);
  const totals = countVariants(mode === "sizes" ? [sizeOnly] : colors);
  const invalidAnchors = useMemo(
    () => new Set(publishIssues.map((issue) => issue.anchor)),
    [publishIssues],
  );

  useEffect(() => {
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state]);

  // ---- how the product is sold -----------------------------------------
  function handleModeChange(next: VariantMode) {
    setMode(next);
    // Both editors keep their drafts across a switch, so nothing is lost by
    // changing your mind. The one thing that goes is the informational
    // "Tamanho" spec row: outside peça única, real per-variant sizes take
    // over from it and leaving it behind would contradict them.
    if (next !== "single") setAttributeRows((prev) => prev.filter((r) => r.key !== "Tamanho"));
  }

  // "Produto sem variações" still has one size worth recording — just not
  // as a pickable option. It's stored as a "Tamanho" spec row (shown on the
  // product page's ficha técnica) rather than on the variant itself: the
  // variant's size stays the sentinel that cart/stock/checkout key off of
  // everywhere, and swapping it for a real size would make the storefront
  // treat this as a normal multi-size product needing a picker.
  const simpleSize = attributeRows.find((r) => r.key === "Tamanho")?.value ?? "";
  function setSimpleSize(size: string) {
    setAttributeRows((prev) => {
      const index = prev.findIndex((r) => r.key === "Tamanho");
      const next = size === prev[index]?.value ? "" : size; // click again to clear
      if (!next) return index === -1 ? prev : prev.filter((_, i) => i !== index);
      if (index === -1) return [...prev, { key: "Tamanho", value: next }];
      return prev.map((r, i) => (i === index ? { ...r, value: next } : r));
    });
  }

  function handlePromoToggle(enabled: boolean) {
    setPromoEnabled(enabled);
    if (enabled) {
      // What was the plain price becomes the struck-through "de" price, and
      // the promotional field below it takes over as what's charged.
      setCompareAtPrice(price);
      setPrice("");
    } else {
      setPrice(compareAtPrice || price);
      setCompareAtPrice("");
    }
  }

  function handleVariantSkuChange(clientId: string, sku: string) {
    // clientId is `${color.id}:${size}` — no color id contains a colon, so
    // the first one always separates the two.
    const separator = clientId.indexOf(":");
    const colorId = clientId.slice(0, separator);
    const size = clientId.slice(separator + 1);
    setColors((prev) =>
      prev.map((color) =>
        color.id !== colorId
          ? color
          : {
              ...color,
              sizes: color.sizes.map((entry) =>
                entry.size === size ? { ...entry, sku, skuManual: sku.trim() !== "" } : entry,
              ),
            },
      ),
    );
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
    promoEnabled,
    categoryId,
    brandId,
    manufacturerRef,
    badge,
    attributeRows,
    status,
    featured,
    position,
    images,
    mode,
    colors,
    sizeOnly,
    simpleSku,
    simpleStock,
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
          setPromoEnabled(v.promoEnabled ?? v.compareAtPrice !== "");
          setCategoryId(v.categoryId);
          setBrandId(v.brandId ?? "");
          setManufacturerRef(v.manufacturerRef ?? "");
          setBadge(v.badge ?? "");
          setAttributeRows(v.attributeRows ?? []);
          setStatus(v.status);
          setFeatured(v.featured);
          setPosition(v.position);
          setImages(v.images);
          setMode(v.mode ?? "colors");
          setColors(v.colors ?? []);
          setSizeOnly(v.sizeOnly ?? makeColorlessColor());
          setSimpleSku(v.simpleSku ?? "");
          setSimpleStock(v.simpleStock ?? 0);
          toast.success("Rascunho restaurado.");
        },
      },
    });
  }, [draftKey]);

  // ---- orphaned-upload cleanup ------------------------------------------
  // Images the operator uploaded this session but never actually saved
  // (abandoned edit, closed tab via in-app nav) shouldn't linger in
  // Storage. `savingRef` is flipped right before a real submit so a
  // *successful* save — which also unmounts this form via redirect() —
  // doesn't trigger the same cleanup on the images it just persisted.
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
      weight_grams: pkgNumber(pkg.weightGrams),
      length_cm: pkgNumber(pkg.lengthCm),
      width_cm: pkgNumber(pkg.widthCm),
      height_cm: pkgNumber(pkg.heightCm),
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
    if (issues.length > 0) {
      event.preventDefault();
      const needsAdvanced = issues.some((issue) => ADVANCED_ANCHORS.has(issue.anchor));
      flushSync(() => {
        setPublishIssues(issues);
        if (needsAdvanced) setAdvancedOpen(true);
      });
      toast.error("Faltam informações para publicar este produto.");
      document
        .getElementById(issues[0].anchor)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setPublishIssues([]);
    // Submission is proceeding — clear the local draft optimistically so a
    // leftover "restore?" prompt doesn't appear after a successful save,
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
    <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-5">
      {publishIssues.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-[var(--danger)] bg-[var(--danger)]/10 p-4"
        >
          <p className="mb-2 text-sm font-medium text-[var(--danger)]">
            Não é possível publicar — falta o seguinte:
          </p>
          <ul className="flex flex-col gap-1">
            {publishIssues.map((issue) => (
              <li key={issue.anchor + issue.message}>
                <a
                  href={`#${issue.anchor}`}
                  onClick={() => {
                    if (ADVANCED_ANCHORS.has(issue.anchor)) setAdvancedOpen(true);
                  }}
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
      <input
        type="hidden"
        name="attributes_json"
        value={JSON.stringify(rowsToAttributes(attributeRows))}
      />
      <input type="hidden" name="tags_json" value={JSON.stringify(tags)} />
      <input type="hidden" name="weight_grams" value={pkgNumber(pkg.weightGrams) ?? ""} />
      <input type="hidden" name="length_cm" value={pkgNumber(pkg.lengthCm) ?? ""} />
      <input type="hidden" name="width_cm" value={pkgNumber(pkg.widthCm) ?? ""} />
      <input type="hidden" name="height_cm" value={pkgNumber(pkg.heightCm) ?? ""} />

      <ProductFormSection step={1} title="Produto">
        <ProductBasicInfo
          name={name}
          onNameChange={(value) => {
            setName(value);
            // Two pieces called "Camisa Polo" would fight over the same
            // address, so the second one becomes camisa-polo-2 as it is
            // typed — visible before saving, not a surprise afterwards.
            if (!slugTouched) setSlug(freeSlug(slugify(value), takenSlugs));
          }}
          slug={slug}
          slugTaken={slugTaken}
          onSlugChange={(value) => {
            setSlugTouched(true);
            setSlug(slugify(value));
          }}
          categories={categoryOptions}
          categoryId={categoryId}
          onCategoryChange={setCategoryId}
          onCategoryCreated={(category) => setCategoryOptions((prev) => [...prev, category])}
          price={price}
          onPriceChange={setPrice}
          compareAtPrice={compareAtPrice}
          onCompareAtPriceChange={setCompareAtPrice}
          promoEnabled={promoEnabled}
          onPromoEnabledChange={handlePromoToggle}
          shortDescription={shortDescription}
          onShortDescriptionChange={setShortDescription}
          invalidAnchors={invalidAnchors}
        />
      </ProductFormSection>

      <ProductFormSection
        step={2}
        title="Fotos"
        description="A primeira imagem será a capa do produto."
        id="field-images"
      >
        <MultiImageUploader
          images={images}
          onChange={setImages}
          checkDuplicate={(file) => checkDuplicatePhoto(file, "general", "Imagens do produto")}
        />
      </ProductFormSection>

      <ProductFormSection
        step={3}
        title="Cores, tamanhos e estoque"
        description="Cada cor gera uma variação por tamanho selecionado."
        id="field-variants"
      >
        <ProductVariantsEditor
          mode={mode}
          onModeChange={handleModeChange}
          colors={colors}
          onColorsChange={setColors}
          sizeOnly={sizeOnly}
          onSizeOnlyChange={setSizeOnly}
          simpleStock={simpleStock}
          onSimpleStockChange={setSimpleStock}
          simpleSize={simpleSize}
          onSimpleSizeChange={setSimpleSize}
          isShoeCategory={isShoeCategory}
          savingRef={savingRef}
          checkDuplicate={checkDuplicatePhoto}
        />
      </ProductFormSection>

      <ProductFormSection
        step={4}
        title="Peso e medidas"
        description="Do pacote fechado, não da peça. É com isso que o frete é calculado."
        id="field-package"
      >
        <ProductPackageFields
          value={pkg}
          onChange={(patch) => setPkg((prev) => ({ ...prev, ...patch }))}
          invalid={invalidAnchors.has("field-package")}
        />
      </ProductFormSection>

      <ProductFormSection
        step={5}
        title="Exibição"
        description="Defina onde o produto será exibido na loja."
      >
        <ProductDisplaySettings
          badge={badge}
          onBadgeChange={setBadge}
          featured={featured}
          onFeaturedChange={setFeatured}
          collection={collection}
          onCollectionChange={setCollection}
        />
      </ProductFormSection>

      <ProductAdvancedSettings
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        description={description}
        onDescriptionChange={setDescription}
        videoUrl={videoUrl}
        onVideoUrlChange={setVideoUrl}
        brands={brandOptions}
        brandId={brandId}
        onBrandChange={setBrandId}
        onBrandCreated={(brand) => setBrandOptions((prev) => [...prev, brand])}
        manufacturerRef={manufacturerRef}
        onManufacturerRefChange={setManufacturerRef}
        tags={tags}
        onTagsChange={setTags}
        attributeRows={attributeRows}
        onAttributeRowsChange={setAttributeRows}
        status={status}
        onStatusChange={setStatus}
        position={position}
        onPositionChange={setPosition}
        shippingNote={shippingNote}
        onShippingNoteChange={setShippingNote}
        exchangeInfo={exchangeInfo}
        onExchangeInfoChange={setExchangeInfo}
        careInstructions={careInstructions}
        onCareInstructionsChange={setCareInstructions}
        singlePiece={mode === "single"}
        simpleSku={simpleSku}
        onSimpleSkuChange={setSimpleSku}
        variants={variants}
        onVariantSkuChange={handleVariantSkuChange}
        existingSkus={existingSkus}
        invalidAnchors={invalidAnchors}
      />

      <ProductFormActionBar
        productName={name}
        coverUrl={images[0]?.url ?? null}
        totals={totals}
        mode={mode}
        simpleStock={simpleStock}
        status={status}
        pending={pending}
        // Each save button stands for a status; flushing it before the
        // submit event means the hidden status field is already right when
        // the form goes out.
        onBeforeSubmit={(next) => flushSync(() => setStatus(next))}
        onCancel={handleCancel}
        onDuplicate={product ? handleDuplicate : undefined}
        duplicating={duplicating}
      />
    </form>
  );
}
