"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Palette,
  Plus,
  RotateCcw,
  Trash2,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/admin/image-uploader";
import { HeroBanner } from "@/components/shop/hero-banner";
import type { ActionResult } from "@/lib/actions/banners";
import type { Banner } from "@/lib/data/banners";
import {
  BANNER_FONTS,
  DEFAULT_BANNER_STYLE,
  DEFAULT_BANNER_TEXTS,
  HEADLINE_SIZES,
  MAX_BANNER_SLIDES,
  googleFontsHref,
  parseBannerStyle,
  parseExtraSlides,
  type BannerFontKey,
  type BannerKind,
  type BannerSlide,
  type BannerStyle,
  type HeroBannerData,
} from "@/lib/banner-style";
import { cn } from "@/lib/utils";

const initialState: ActionResult = { status: "idle" };

const FONT_OPTIONS = Object.entries(BANNER_FONTS) as [BannerFontKey, (typeof BANNER_FONTS)[BannerFontKey]][];

const COLOR_FIELDS: { key: keyof BannerStyle; label: string }[] = [
  { key: "bgColor", label: "Fundo" },
  { key: "textColor", label: "Título" },
  { key: "highlightColor", label: "Destaque do título (preço)" },
  { key: "eyebrowColor", label: "Frase pequena: linha e destaque" },
  { key: "subtitleColor", label: "Texto de apoio" },
  { key: "buttonColor", label: "Botão" },
  { key: "buttonTextColor", label: "Texto do botão" },
];

/** A sample WhatsApp link, only so the preview shows the button. */
const PREVIEW_WHATSAPP = "#whatsapp";

/** A slide in the form: a stable key so its photo field never remounts. */
type SlideDraft = BannerSlide & { key: number };

const TEXT_KEYS = [
  "eyebrow",
  "eyebrowHighlight",
  "headline",
  "highlight",
  "subtitle",
  "ctaLabel",
  "ctaHref",
] as const;

export function BannerForm({
  banner,
  action,
}: {
  banner?: Banner;
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();
  const isNew = !banner;
  // A banner from before the full-screen banners (never saved by this
  // form, so no style): it only had a photo, so it opens with the
  // approved art's texts instead of empty fields.
  const legacy = !!banner && banner.kind !== "pronto" && !banner.style;
  const fill = isNew || legacy;
  const text = (value: string | null | undefined, fallback: string) =>
    legacy ? fallback : (value ?? (fill ? fallback : ""));

  const [kind, setKind] = useState<BannerKind>(banner?.kind === "pronto" ? "pronto" : "editavel");
  const [slides, setSlides] = useState<SlideDraft[]>(() => {
    const first: Omit<BannerSlide, "image"> = {
      eyebrow: text(banner?.eyebrow, DEFAULT_BANNER_TEXTS.eyebrow),
      eyebrowHighlight: text(banner?.eyebrow_highlight, DEFAULT_BANNER_TEXTS.eyebrowHighlight),
      headline: text(banner?.headline_line1, DEFAULT_BANNER_TEXTS.headline),
      highlight: text(banner?.headline_line2, DEFAULT_BANNER_TEXTS.highlight),
      subtitle: text(banner?.subtitle, DEFAULT_BANNER_TEXTS.subtitle),
      ctaLabel: text(banner?.cta_label, DEFAULT_BANNER_TEXTS.ctaLabel),
      ctaHref: banner?.cta_href ?? DEFAULT_BANNER_TEXTS.ctaHref,
    };
    const extra = banner?.kind === "pronto" ? [] : parseExtraSlides(banner?.extra_images, first);
    return [{ ...first, image: banner?.image_url ?? null }, ...extra].map((slide, key) => ({
      ...slide,
      key,
    }));
  });
  const nextKey = useRef(slides.length);
  const [currentSlide, setCurrentSlide] = useState(0);
  const current = Math.min(currentSlide, slides.length - 1);
  const slide = slides[current];
  const first = slides[0];

  const [showWhatsapp, setShowWhatsapp] = useState(banner?.show_whatsapp ?? true);
  const [whatsappLabel, setWhatsappLabel] = useState(
    banner?.whatsapp_label ?? DEFAULT_BANNER_TEXTS.whatsappLabel,
  );
  const [badge, setBadge] = useState(text(banner?.badge, DEFAULT_BANNER_TEXTS.badge));
  const [mobileImageUrl, setMobileImageUrl] = useState<string | null>(
    banner?.mobile_image_url ?? null,
  );
  const [style, setStyle] = useState<BannerStyle>(() => parseBannerStyle(banner?.style));
  const [active, setActive] = useState(banner?.active ?? true);
  const [position, setPosition] = useState(banner?.position ?? 0);

  // Suppresses the ImageUploaders' unmount cleanup once a real submit is
  // underway, so a successful save doesn't delete the image it just set.
  const savingRef = useRef(false);

  useEffect(() => {
    if (state.status === "error" && state.message) {
      toast.error(state.message);
      savingRef.current = false;
    }
  }, [state]);

  const setStyleField = <K extends keyof BannerStyle>(key: K, value: BannerStyle[K]) =>
    setStyle((currentStyle) => ({ ...currentStyle, [key]: value }));

  const updateSlide = (key: number, patch: Partial<BannerSlide>) =>
    setSlides((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const addSlide = () => {
    // The new photo starts with this one's texts: change only what differs.
    const copy: SlideDraft = { ...slide, image: null, key: nextKey.current++ };
    setSlides((list) => [...list, copy]);
    setCurrentSlide(slides.length);
  };

  const removeSlide = () => {
    if (slides.length < 2) return;
    setSlides((list) => list.filter((item) => item.key !== slide.key));
    setCurrentSlide(Math.max(0, current - 1));
  };

  const strip = (item: SlideDraft): BannerSlide => {
    const { key, ...rest } = item;
    void key;
    return rest;
  };
  const extraSlides = kind === "pronto" ? [] : slides.slice(1).map(strip);

  const preview: HeroBannerData = {
    id: banner?.id ?? "novo",
    kind,
    eyebrow: first.eyebrow,
    eyebrowHighlight: first.eyebrowHighlight,
    headline: first.headline,
    highlight: first.highlight,
    subtitle: first.subtitle,
    ctaLabel: first.ctaLabel,
    ctaHref: first.ctaHref || "/colecao",
    showWhatsapp,
    whatsappLabel,
    badge,
    imageUrl: first.image,
    mobileImageUrl,
    extraSlides,
    style,
  };
  const fontsHref = googleFontsHref([style]);

  return (
    <div className="grid grid-cols-1 gap-10 2xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
      {fontsHref && <link rel="stylesheet" href={fontsHref} precedence="default" />}
      <form
        action={formAction}
        onSubmit={() => {
          savingRef.current = true;
        }}
        className="flex min-w-0 flex-col gap-8"
      >
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="eyebrow" value={first.eyebrow} />
        <input type="hidden" name="eyebrow_highlight" value={first.eyebrowHighlight} />
        <input type="hidden" name="headline_line1" value={first.headline} />
        <input type="hidden" name="headline_line2" value={first.highlight} />
        <input type="hidden" name="subtitle" value={first.subtitle} />
        <input type="hidden" name="cta_label" value={first.ctaLabel} />
        <input type="hidden" name="cta_href" value={first.ctaHref} />
        <input type="hidden" name="whatsapp_label" value={whatsappLabel} />
        <input type="hidden" name="badge" value={badge} />
        <input type="hidden" name="image_url" value={first.image ?? ""} />
        <input type="hidden" name="mobile_image_url" value={mobileImageUrl ?? ""} />
        <input
          type="hidden"
          name="extra_slides"
          value={JSON.stringify(extraSlides.filter((item) => item.image || item.headline))}
        />
        <input type="hidden" name="style" value={JSON.stringify(style)} />
        {/* Fields of the earlier banner form, kept as they were. */}
        <input type="hidden" name="wordmark" value={banner?.wordmark ?? ""} />
        <input type="hidden" name="cutout_url" value={banner?.cutout_url ?? ""} />
        <input type="hidden" name="featured_product_id" value={banner?.featured_product_id ?? ""} />

        <div className="flex flex-wrap items-end gap-6 rounded-lg border border-line bg-card p-4">
          <div className="flex items-center gap-3">
            <Switch id="active" name="active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="active">{active ? "Ativado no site" : "Desativado"}</Label>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="position">Ordem entre banners</Label>
            <Input
              id="position"
              name="position"
              type="number"
              min={0}
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
              className="w-24"
            />
          </div>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-label mb-3">Tipo de banner</legend>
          <div className="grid grid-cols-2 gap-3">
            <KindOption
              selected={kind === "editavel"}
              onSelect={() => setKind("editavel")}
              icon={<Type className="size-5" aria-hidden="true" />}
              title="Banner editável"
              text="Fotos com frases, fontes e cores pelo painel."
            />
            <KindOption
              selected={kind === "pronto"}
              onSelect={() => setKind("pronto")}
              icon={<ImageIcon className="size-5" aria-hidden="true" />}
              title="Banner pronto"
              text="Uma imagem já feita (Canva, designer…)."
            />
          </div>
        </fieldset>

        {kind === "pronto" ? (
          <Section title="Imagens do banner pronto">
            <p className="text-sm text-ink-muted">
              Uma imagem só, para celular e computador. Ela aparece inteira, sem cortes; no
              computador fica centralizada, na altura da tela.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <ImageUploader
                label="Imagem (celular e computador)"
                value={first.image}
                onChange={(url) => updateSlide(first.key, { image: url })}
                folder="banners"
                aspect="aspect-[4/5]"
                savingRef={savingRef}
              />
              {/* An older ready banner may have a phone-only image; it
                  shows here so it can be removed. */}
              {mobileImageUrl && (
                <ImageUploader
                  label="Imagem só do celular"
                  value={mobileImageUrl}
                  onChange={setMobileImageUrl}
                  folder="banners"
                  aspect="aspect-[4/5]"
                  savingRef={savingRef}
                />
              )}
            </div>
            <Field id="readyHref" label="Ao tocar, abre (link)">
              <Input
                id="readyHref"
                value={first.ctaHref}
                onChange={(e) => updateSlide(first.key, { ctaHref: e.target.value })}
                placeholder="/colecao"
              />
            </Field>
            <Field id="readyAlt" label="Descrição da imagem (para o Google e leitores de tela)">
              <Input
                id="readyAlt"
                value={first.headline}
                onChange={(e) => updateSlide(first.key, { headline: e.target.value })}
              />
            </Field>
          </Section>
        ) : (
          <>
            <Section title="Fotos e frases">
              <p className="text-xs text-ink-muted">
                Cada foto tem as suas frases e elas passam em carrossel, uma a cada 6 segundos.
                No computador o banner aparece com a foto à direita e as frases à esquerda,
                como na arte.
              </p>

              <div className="flex items-center gap-2 rounded-lg border border-line bg-card p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Foto anterior"
                  disabled={current === 0}
                  onClick={() => setCurrentSlide(current - 1)}
                >
                  <ChevronLeft className="size-5" />
                </Button>
                <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
                  {slides.map((item, index) => (
                    <button
                      key={item.key}
                      type="button"
                      aria-label={`Foto ${index + 1}`}
                      aria-current={index === current}
                      onClick={() => setCurrentSlide(index)}
                      className={cn(
                        "flex size-9 items-center justify-center rounded-md border text-sm font-semibold transition-colors",
                        index === current
                          ? "border-gold bg-bg text-gold-text"
                          : "border-line text-ink-muted hover:border-line-strong",
                      )}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Próxima foto"
                  disabled={current === slides.length - 1}
                  onClick={() => setCurrentSlide(current + 1)}
                >
                  <ChevronRight className="size-5" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {slides.length < MAX_BANNER_SLIDES && (
                  <Button type="button" variant="outline" onClick={addSlide}>
                    <Plus className="size-4" aria-hidden="true" /> Adicionar foto
                  </Button>
                )}
                {slides.length > 1 && (
                  <Button type="button" variant="ghost" onClick={removeSlide}>
                    <Trash2 className="size-4" aria-hidden="true" /> Remover foto {current + 1}
                  </Button>
                )}
              </div>

              {/* Every slide's photo field stays mounted (only the current
                  one shows): unmounting one would delete a photo uploaded
                  in this visit before it was saved. */}
              {slides.map((item, index) => (
                <div key={item.key} className={cn(index !== current && "hidden")}>
                  <div className="grid grid-cols-2 gap-4">
                    <ImageUploader
                      label={`Foto ${index + 1}`}
                      value={item.image}
                      onChange={(url) => updateSlide(item.key, { image: url })}
                      folder="banners"
                      aspect="aspect-[4/5]"
                      savingRef={savingRef}
                    />
                    {/* Older banners may have a phone-only photo; it shows
                        here so it can be removed. */}
                    {index === 0 && mobileImageUrl && (
                      <ImageUploader
                        label="Foto só do celular"
                        value={mobileImageUrl}
                        onChange={setMobileImageUrl}
                        folder="banners"
                        aspect="aspect-[4/5]"
                        savingRef={savingRef}
                      />
                    )}
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-[1fr_120px] gap-3">
                <Field id="eyebrow" label="Frase pequena">
                  <Input
                    id="eyebrow"
                    value={slide.eyebrow}
                    onChange={(e) => updateSlide(slide.key, { eyebrow: e.target.value })}
                  />
                </Field>
                <Field id="eyebrowHighlight" label="Em destaque">
                  <Input
                    id="eyebrowHighlight"
                    value={slide.eyebrowHighlight}
                    onChange={(e) => updateSlide(slide.key, { eyebrowHighlight: e.target.value })}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-[1fr_140px] gap-3">
                <Field id="headline" label="Título">
                  <Input
                    id="headline"
                    value={slide.headline}
                    onChange={(e) => updateSlide(slide.key, { headline: e.target.value })}
                  />
                </Field>
                <Field id="highlight" label="Final em destaque">
                  <Input
                    id="highlight"
                    value={slide.highlight}
                    onChange={(e) => updateSlide(slide.key, { highlight: e.target.value })}
                  />
                </Field>
              </div>
              <Field id="subtitle" label="Texto de apoio">
                <Textarea
                  id="subtitle"
                  rows={3}
                  value={slide.subtitle}
                  onChange={(e) => updateSlide(slide.key, { subtitle: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field id="ctaLabel" label="Botão principal">
                  <Input
                    id="ctaLabel"
                    value={slide.ctaLabel}
                    onChange={(e) => updateSlide(slide.key, { ctaLabel: e.target.value })}
                  />
                </Field>
                <Field id="ctaHref" label="Link do botão">
                  <Input
                    id="ctaHref"
                    value={slide.ctaHref}
                    onChange={(e) => updateSlide(slide.key, { ctaHref: e.target.value })}
                    placeholder="/colecao"
                  />
                </Field>
              </div>
              {slides.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  className="self-start"
                  onClick={() =>
                    setSlides((list) =>
                      list.map((item) =>
                        item.key === slide.key
                          ? item
                          : {
                              ...item,
                              ...Object.fromEntries(TEXT_KEYS.map((key) => [key, slide[key]])),
                            },
                      ),
                    )
                  }
                >
                  Usar estas frases em todas as fotos
                </Button>
              )}
            </Section>

            <Section title="Botão do WhatsApp e selo">
              <div className="flex flex-col gap-3 rounded-lg border border-line p-3">
                <div className="flex items-center gap-3">
                  <Switch
                    id="show_whatsapp"
                    name="show_whatsapp"
                    checked={showWhatsapp}
                    onCheckedChange={setShowWhatsapp}
                  />
                  <Label htmlFor="show_whatsapp">Botão do WhatsApp</Label>
                </div>
                {showWhatsapp && (
                  <Input
                    aria-label="Texto do botão do WhatsApp"
                    value={whatsappLabel}
                    onChange={(e) => setWhatsappLabel(e.target.value)}
                  />
                )}
              </div>
              <Field id="badge" label="Selo no canto (vazio esconde)">
                <Input id="badge" value={badge} onChange={(e) => setBadge(e.target.value)} />
              </Field>
            </Section>

            <Section title="Ajustes das fotos">
              <RangeField
                id="focusMobile"
                label="Altura da foto no celular"
                hint="0 mostra o topo da foto, 100 a parte de baixo"
                value={style.focusMobile}
                min={0}
                max={100}
                onChange={(value) => setStyleField("focusMobile", value)}
              />
              <RangeField
                id="focusDesktop"
                label="Altura da foto no computador"
                value={style.focusDesktop}
                min={0}
                max={100}
                onChange={(value) => setStyleField("focusDesktop", value)}
              />
              <RangeField
                id="overlay"
                label="Escurecer a foto"
                value={style.overlay}
                min={0}
                max={80}
                suffix="%"
                onChange={(value) => setStyleField("overlay", value)}
              />
            </Section>

            <Section title="Fontes">
              <div className="grid grid-cols-2 gap-3">
                <FontField id="headlineFont" label="Título" value={style.headlineFont} onChange={(v) => setStyleField("headlineFont", v)} />
                <FontField id="eyebrowFont" label="Frase pequena" value={style.eyebrowFont} onChange={(v) => setStyleField("eyebrowFont", v)} />
                <FontField id="bodyFont" label="Texto de apoio" value={style.bodyFont} onChange={(v) => setStyleField("bodyFont", v)} />
                <FontField id="buttonFont" label="Botão" value={style.buttonFont} onChange={(v) => setStyleField("buttonFont", v)} />
                <Field id="headlineSize" label="Tamanho do título">
                  <NativeSelect
                    id="headlineSize"
                    value={style.headlineSize}
                    onChange={(value) => setStyleField("headlineSize", value as BannerStyle["headlineSize"])}
                    options={Object.entries(HEADLINE_SIZES).map(([key, size]) => [key, size.label])}
                  />
                </Field>
                <div className="flex items-center gap-3 self-end pb-2">
                  <Switch
                    id="uppercase"
                    checked={style.uppercase}
                    onCheckedChange={(value) => setStyleField("uppercase", value)}
                  />
                  <Label htmlFor="uppercase">Título em MAIÚSCULAS</Label>
                </div>
              </div>
            </Section>

            <Section title="Cores">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {COLOR_FIELDS.map(({ key, label }) => (
                  <ColorField
                    key={key}
                    id={key}
                    label={label}
                    value={style[key] as string}
                    onChange={(value) => setStyleField(key, value as never)}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                className="self-start"
                onClick={() =>
                  setStyle((currentStyle) => ({
                    ...DEFAULT_BANNER_STYLE,
                    focusMobile: currentStyle.focusMobile,
                    focusDesktop: currentStyle.focusDesktop,
                  }))
                }
              >
                <RotateCcw className="size-4" aria-hidden="true" /> Voltar fontes e cores ao padrão
              </Button>
            </Section>
          </>
        )}

        <div className="sticky bottom-0 z-10 -mx-1 flex items-center gap-3 border-t border-line bg-bg/95 px-1 py-4 backdrop-blur">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Salvando…" : "Salvar banner"}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => router.push("/admin/banners")}>
            Cancelar
          </Button>
        </div>
      </form>

      <div className="min-w-0 2xl:sticky 2xl:top-6 2xl:self-start">
        <p className="text-label mb-3">
          Como fica no site{kind === "editavel" && slides.length > 1 ? ` — foto ${current + 1}` : ""}
        </p>
        <ScaledPreview width={390} maxWidth={360}>
          <HeroBanner
            banner={preview}
            whatsappHref={showWhatsapp ? PREVIEW_WHATSAPP : null}
            frameClass="h-[760px]"
            slide={current}
          />
        </ScaledPreview>
        <p className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
          <Palette className="size-3.5" aria-hidden="true" />
          No site o banner ocupa a tela toda, logo abaixo do topo.
        </p>
      </div>
    </div>
  );
}

/** Renders the banner at its real width and shrinks it to fit the column. */
function ScaledPreview({
  width,
  maxWidth,
  children,
}: {
  width: number;
  maxWidth?: number;
  children: ReactNode;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const box = outer.current;
    const content = inner.current;
    if (!box || !content) return;
    const update = () => {
      const available = Math.min(box.clientWidth, maxWidth ?? Infinity);
      const next = Math.min(1, available / width);
      setScale(next);
      setHeight(content.offsetHeight * next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    observer.observe(content);
    return () => observer.disconnect();
  }, [width, maxWidth]);

  return (
    <div ref={outer} className="w-full">
      <div
        className="storefront-theme mx-auto overflow-hidden rounded-xl border border-line"
        style={{ width: width * scale, height: height || undefined }}
        // Links in the preview don't leave the form.
        onClickCapture={(event) => event.preventDefault()}
      >
        <div ref={inner} style={{ width, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function KindOption({
  selected,
  onSelect,
  icon,
  title,
  text,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors duration-150",
        selected ? "border-gold bg-card" : "border-line hover:border-line-strong",
      )}
    >
      <span className={selected ? "text-gold-text" : "text-ink-muted"}>{icon}</span>
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs text-ink-muted">{text}</span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-label mb-3">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function NativeSelect({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-md border border-line bg-field px-3 text-sm text-fg"
    >
      {options.map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}

function FontField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: BannerFontKey;
  onChange: (value: BannerFontKey) => void;
}) {
  return (
    <Field id={id} label={label}>
      <NativeSelect
        id={id}
        value={value}
        onChange={(v) => onChange(v as BannerFontKey)}
        options={FONT_OPTIONS.map(([key, font]) => [key, font.label])}
      />
    </Field>
  );
}

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="size-11 shrink-0 cursor-pointer rounded-md border border-line bg-transparent p-1"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Label htmlFor={id} className="text-xs">
          {label}
        </Label>
        <Input
          aria-label={`${label} (código)`}
          value={text}
          maxLength={7}
          className="h-8 font-mono text-xs"
          onChange={(e) => {
            const next = e.target.value.trim();
            setText(next);
            if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next.toUpperCase());
          }}
        />
      </div>
    </div>
  );
}

function RangeField({
  id,
  label,
  hint,
  value,
  min,
  max,
  suffix = "",
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-xs tabular-nums text-ink-muted">
          {value}
          {suffix}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--gold,#cda96b)]"
      />
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
