"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
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
import { ImageUploader } from "@/components/admin/image-uploader";
import { Hero } from "@/components/shop/hero";
import { CartProvider } from "@/lib/cart/context";
import type { ActionResult } from "@/lib/actions/banners";
import type { Banner } from "@/lib/data/banners";
import type { ProductOption } from "@/lib/data/products";
import type { SiteSettings } from "@/lib/data/settings";

const initialState: ActionResult = { status: "idle" };
const NONE = "__none__";

export function BannerForm({
  banner,
  action,
  productOptions,
  settings,
}: {
  banner?: Banner;
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  productOptions: ProductOption[];
  settings: SiteSettings;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();

  const [eyebrow, setEyebrow] = useState(banner?.eyebrow ?? "");
  const [line1, setLine1] = useState(banner?.headline_line1 ?? "");
  const [line2, setLine2] = useState(banner?.headline_line2 ?? "");
  const [wordmark, setWordmark] = useState(banner?.wordmark ?? "");
  const [ctaLabel, setCtaLabel] = useState(banner?.cta_label ?? "COMPRAR AGORA →");
  const [ctaHref, setCtaHref] = useState(banner?.cta_href ?? "/colecao");
  const [imageUrl, setImageUrl] = useState<string | null>(banner?.image_url ?? null);
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(banner?.cutout_url ?? null);
  const [featuredProductId, setFeaturedProductId] = useState(
    banner?.featured_product_id ?? NONE,
  );
  const [active, setActive] = useState(banner?.active ?? false);
  const [position, setPosition] = useState(banner?.position ?? 0);

  useEffect(() => {
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state]);

  const selectedProduct = useMemo(
    () => productOptions.find((p) => p.id === featuredProductId) ?? null,
    [productOptions, featuredProductId],
  );

  return (
    <div className="grid grid-cols-1 gap-10 xl:grid-cols-[420px_1fr]">
      <form action={formAction} className="flex flex-col gap-6">
        <input type="hidden" name="eyebrow" value={eyebrow} />
        <input type="hidden" name="headline_line1" value={line1} />
        <input type="hidden" name="headline_line2" value={line2} />
        <input type="hidden" name="wordmark" value={wordmark} />
        <input type="hidden" name="cta_label" value={ctaLabel} />
        <input type="hidden" name="cta_href" value={ctaHref} />
        <input type="hidden" name="image_url" value={imageUrl ?? ""} />
        <input type="hidden" name="cutout_url" value={cutoutUrl ?? ""} />
        <input
          type="hidden"
          name="featured_product_id"
          value={featuredProductId === NONE ? "" : featuredProductId}
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor="eyebrow">Eyebrow</Label>
          <Input id="eyebrow" value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} className="rounded-none" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="wordmark">Wordmark</Label>
          <Input id="wordmark" value={wordmark} onChange={(e) => setWordmark(e.target.value)} className="rounded-none" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="line1">Headline linha 1</Label>
            <Input id="line1" value={line1} onChange={(e) => setLine1(e.target.value)} className="rounded-none" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="line2">Headline linha 2</Label>
            <Input id="line2" value={line2} onChange={(e) => setLine2(e.target.value)} className="rounded-none" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ctaLabel">CTA — texto</Label>
            <Input id="ctaLabel" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} className="rounded-none" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ctaHref">CTA — link</Label>
            <Input id="ctaHref" value={ctaHref} onChange={(e) => setCtaHref(e.target.value)} className="rounded-none" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ImageUploader
            label="Imagem de fundo"
            value={imageUrl}
            onChange={setImageUrl}
            folder="banners"
          />
          <ImageUploader
            label="Recorte (PNG, opcional)"
            value={cutoutUrl}
            onChange={setCutoutUrl}
            folder="banners"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="featured_product">Produto em destaque</Label>
          <Select value={featuredProductId} onValueChange={setFeaturedProductId}>
            <SelectTrigger id="featured_product" className="rounded-none">
              <SelectValue placeholder="Nenhum" />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              <SelectItem value={NONE}>Nenhum</SelectItem>
              {productOptions.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Switch
              id="active"
              name="active"
              checked={active}
              onCheckedChange={setActive}
            />
            <Label htmlFor="active">Ativo</Label>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="position">Posição</Label>
            <Input
              id="position"
              name="position"
              type="number"
              min={0}
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
              className="w-24 rounded-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => router.push("/admin/banners")}
          >
            Cancelar
          </Button>
        </div>
      </form>

      <div>
        <p className="text-label mb-3">Preview ao vivo</p>
        <div
          className="relative overflow-hidden border border-line"
          style={{ height: 460 }}
        >
          <div
            className="origin-top-left"
            style={{ transform: "scale(0.42)", width: "238%" }}
          >
          <CartProvider>
            <Hero
              eyebrow={eyebrow || null}
              headlineLine1={line1 || null}
              headlineLine2={line2 || null}
              wordmark={wordmark || null}
              ctaLabel={ctaLabel || null}
              ctaHref={ctaHref || null}
              imageUrl={imageUrl}
              cutoutUrl={cutoutUrl}
              featuredProduct={
                selectedProduct
                  ? {
                      slug: selectedProduct.slug,
                      name: selectedProduct.name,
                      description: selectedProduct.description,
                      price: selectedProduct.price,
                      cartItem: null,
                    }
                  : null
              }
              socialLinks={{
                instagram: settings.instagram,
                tiktok: settings.tiktok,
                youtube: settings.youtube,
              }}
              shippingNote={settings.shipping_note}
              freeShippingNote={settings.free_shipping_note}
            />
          </CartProvider>
          </div>
        </div>
      </div>
    </div>
  );
}
