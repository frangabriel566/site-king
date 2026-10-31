"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProductSelect } from "@/components/admin/product-select";
import { saveHomeSettingsAction, type HomeActionResult } from "@/lib/actions/home";
import type { HomeImages, HomeSettingsRow } from "@/lib/data/home";
import { ImageUploader } from "@/components/admin/image-uploader";
import { ProductPhotoPicker } from "@/components/admin/product-photo-picker";
import type { ProductOption } from "@/lib/data/products";
import { formatCurrency } from "@/lib/format";

const initialState: HomeActionResult = { status: "idle" };
const NONE = "__none__";

type Defaults = {
  eyebrow: string;
  eyebrow_highlight: string;
  headline: string;
  subtitle: string;
  cta_label: string;
  cta_href: string;
  whatsapp_label: string;
};

/**
 * Painel → Página inicial. Each field starts filled with what the site shows
 * today; saving a field empty brings back the default text.
 */
export function HomeSettingsForm({
  row,
  images,
  kitTitle: initialKitTitle,
  kitProductId: initialKitProductId,
  productPhotos,
  defaults,
  productOptions,
  autoPrice,
}: {
  row: HomeSettingsRow | null;
  /** The photos fixed today; null is "automatic". */
  images: HomeImages;
  kitTitle: string | null;
  kitProductId: string | null;
  /** Every photo of each product, by product id. */
  productPhotos: Record<string, string[]>;
  defaults: Defaults;
  productOptions: ProductOption[];
  /** The lowest shelf price, shown when the gold highlight is left empty. */
  autoPrice: number | null;
}) {
  const [state, formAction, pending] = useActionState(saveHomeSettingsAction, initialState);

  const [eyebrow, setEyebrow] = useState(row?.eyebrow ?? defaults.eyebrow);
  const [eyebrowHighlight, setEyebrowHighlight] = useState(
    row?.eyebrow_highlight ?? defaults.eyebrow_highlight,
  );
  const [headline, setHeadline] = useState(row?.headline ?? defaults.headline);
  const [headlineHighlight, setHeadlineHighlight] = useState(row?.headline_highlight ?? "");
  const [subtitle, setSubtitle] = useState(row?.subtitle ?? defaults.subtitle);
  const [ctaLabel, setCtaLabel] = useState(row?.cta_label ?? defaults.cta_label);
  const [ctaHref, setCtaHref] = useState(row?.cta_href ?? defaults.cta_href);
  const [whatsappLabel, setWhatsappLabel] = useState(
    row?.whatsapp_label ?? defaults.whatsapp_label,
  );
  const [featuredProductId, setFeaturedProductId] = useState(row?.featured_product_id ?? NONE);
  const [featuredLabel, setFeaturedLabel] = useState(row?.featured_label ?? "");
  const [heroImage, setHeroImage] = useState<string | null>(images.hero_image_url);
  const [kitTitle, setKitTitle] = useState(initialKitTitle ?? "");
  const [kitImage, setKitImage] = useState<string | null>(images.kit_image_url);
  const [kitProductId, setKitProductId] = useState<string | null>(initialKitProductId);
  // Only picks which photos to show; what is saved is the photo itself.
  const [heroProductId, setHeroProductId] = useState<string | null>(() => {
    const url = images.hero_image_url;
    if (!url) return null;
    return Object.keys(productPhotos).find((id) => productPhotos[id].includes(url)) ?? null;
  });
  const kitProduct = productOptions.find((p) => p.id === kitProductId) ?? null;
  // Keeps the uploaders from deleting a just-saved photo (image-uploader.tsx).
  const savingRef = useRef(false);

  useEffect(() => {
    if (state.status === "error" && state.message) {
      toast.error(state.message);
      savingRef.current = false;
    }
    if (state.status === "success") toast.success(state.message ?? "Salvo.");
  }, [state]);

  const featuredProduct = productOptions.find((p) => p.id === featuredProductId) ?? null;
  const previewHighlight =
    headlineHighlight.trim() ||
    (autoPrice !== null ? formatCurrency(autoPrice) : "R$ (menor preço)");

  return (
    <div className="grid grid-cols-1 gap-10 xl:grid-cols-[460px_1fr]">
      <form
        action={formAction}
        onSubmit={() => {
          savingRef.current = true;
        }}
        className="flex flex-col gap-6"
      >
        <input type="hidden" name="hero_image_url" value={heroImage ?? ""} />
        <input type="hidden" name="kit_image_url" value={kitImage ?? ""} />
        <input type="hidden" name="kit_product_id" value={kitProductId ?? ""} />
        <input
          type="hidden"
          name="featured_product_id"
          value={featuredProductId === NONE ? "" : featuredProductId}
        />

        <fieldset className="flex flex-col gap-4">
          <legend className="text-label mb-3">Topo da página</legend>
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="eyebrow">Frase pequena</Label>
              <Input
                id="eyebrow"
                name="eyebrow"
                value={eyebrow}
                onChange={(e) => setEyebrow(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="eyebrow_highlight">Em dourado</Label>
              <Input
                id="eyebrow_highlight"
                name="eyebrow_highlight"
                value={eyebrowHighlight}
                onChange={(e) => setEyebrowHighlight(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="headline">Título</Label>
            <Input
              id="headline"
              name="headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="headline_highlight">Final do título em dourado</Label>
            <Input
              id="headline_highlight"
              name="headline_highlight"
              value={headlineHighlight}
              placeholder={
                autoPrice !== null
                  ? `Automático: ${formatCurrency(autoPrice)}`
                  : "Automático: menor preço da home"
              }
              onChange={(e) => setHeadlineHighlight(e.target.value)}
            />
            <p className="text-xs text-ink-muted">
              Deixe vazio para mostrar sozinho o menor preço dos produtos da home.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="subtitle">Texto de apoio</Label>
            <Textarea
              id="subtitle"
              name="subtitle"
              rows={3}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
            />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="text-label mb-3">Botões</legend>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cta_label">Botão principal</Label>
              <Input
                id="cta_label"
                name="cta_label"
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cta_href">Link do botão</Label>
              <Input
                id="cta_href"
                name="cta_href"
                value={ctaHref}
                onChange={(e) => setCtaHref(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="whatsapp_label">Botão do WhatsApp</Label>
            <Input
              id="whatsapp_label"
              name="whatsapp_label"
              value={whatsappLabel}
              onChange={(e) => setWhatsappLabel(e.target.value)}
            />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="text-label mb-3">Produto em destaque (card sobre a foto)</legend>
          <div className="flex flex-col gap-2">
            <Label htmlFor="featured_product">Produto</Label>
            <ProductSelect
              id="featured_product"
              value={featuredProductId === NONE ? null : featuredProductId}
              onChange={(picked) => setFeaturedProductId(picked ?? NONE)}
              noneLabel="Automático (o do banner ou o último lançamento)"
              productOptions={productOptions}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="featured_label">Nome no card</Label>
            <Input
              id="featured_label"
              name="featured_label"
              value={featuredLabel}
              disabled={!featuredProduct}
              placeholder={featuredProduct?.name ?? "Escolha um produto acima"}
              onChange={(e) => setFeaturedLabel(e.target.value)}
            />
            <p className="text-xs text-ink-muted">
              Só muda o texto do card na home. O nome do produto continua o mesmo.
            </p>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-5">
          <legend className="text-label mb-3">Foto do topo</legend>
          <ProductPhotoPicker
            id="hero_photo_product"
            label="Pegar a foto de um produto"
            noneLabel="Nenhum (enviar foto própria)"
            productId={heroProductId}
            onProductChange={setHeroProductId}
            value={heroImage}
            onChange={setHeroImage}
            productOptions={productOptions}
            photos={productPhotos}
          />
          <div className="flex flex-col gap-2">
            <ImageUploader
              label="Foto escolhida (ou envie outra)"
              value={heroImage}
              onChange={setHeroImage}
              folder="banners"
              aspect="aspect-[4/5] max-w-[240px]"
              savingRef={savingRef}
            />
            <p className="text-xs text-ink-muted">
              Fica fixa até você trocar. Sem foto aqui, o site usa a do primeiro banner ativo.
            </p>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-5">
          <legend className="text-label mb-3">Bloco KITS (Monte o look)</legend>
          <ProductPhotoPicker
            id="kit_product"
            label="Produto do kit"
            noneLabel="Automático (o primeiro da vitrine KITS)"
            productId={kitProductId}
            onProductChange={setKitProductId}
            value={kitImage}
            onChange={setKitImage}
            productOptions={productOptions}
            photos={productPhotos}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="kit_title">Nome no bloco KITS</Label>
            <Input
              id="kit_title"
              name="kit_title"
              value={kitTitle}
              maxLength={80}
              placeholder={kitProduct ? kitProduct.name : "Automático: o nome do kit"}
              onChange={(e) => setKitTitle(e.target.value)}
            />
            <p className="text-xs text-ink-muted">
              Só muda o título na home. O nome do produto continua o mesmo.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <ImageUploader
              label="Foto escolhida (ou envie outra)"
              value={kitImage}
              onChange={setKitImage}
              folder="banners"
              aspect="aspect-[4/5] max-w-[240px]"
              savingRef={savingRef}
            />
            <p className="text-xs text-ink-muted">
              Fica fixa até você trocar. Sem foto aqui, o site usa a primeira foto do kit.
            </p>
          </div>
        </fieldset>

        <div>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </form>

      <div>
        <p className="text-label mb-3">Prévia</p>
        <div className="storefront-theme flex flex-col gap-4 rounded-lg bg-bg p-6 text-fg">
          <p className="flex items-center gap-3 font-label text-[11px] tracking-[0.22em]">
            <span aria-hidden="true" className="h-0.5 w-10 shrink-0 bg-gold-text" />
            {eyebrow || defaults.eyebrow}
            {(eyebrowHighlight || defaults.eyebrow_highlight) && (
              <span className="text-gold-text">
                {eyebrowHighlight || defaults.eyebrow_highlight}
              </span>
            )}
          </p>
          <p className="font-display text-3xl font-black uppercase leading-tight">
            {headline || defaults.headline}
            {previewHighlight && (
              <>
                {" "}
                <span className="text-gold-text">{previewHighlight}</span>
              </>
            )}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {subtitle || defaults.subtitle}
          </p>
          <div className="flex flex-wrap gap-3">
            <span className="bg-buy inline-flex items-center gap-2 rounded-[10px] px-5 py-3 font-display text-sm font-extrabold tracking-[0.06em] text-on-buy">
              {ctaLabel || defaults.cta_label}
              <ArrowRight className="size-4" aria-hidden="true" />
            </span>
            <span className="inline-flex items-center gap-2 rounded-[10px] border border-line-strong px-5 py-3 text-sm font-semibold">
              <MessageCircle className="size-4" aria-hidden="true" />
              {whatsappLabel || defaults.whatsapp_label}
            </span>
          </div>
          {featuredProduct && (
            <div className="mt-2 w-fit rounded-xl border border-line bg-bg px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {featuredLabel.trim() || featuredProduct.name}
              </p>
              <p className="font-display text-xl font-extrabold">
                {formatCurrency(featuredProduct.price)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
