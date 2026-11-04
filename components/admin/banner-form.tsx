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
import { ImageIcon, Monitor, Plus, Palette, RotateCcw, Smartphone, Type } from "lucide-react";
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
  MAX_BANNER_PHOTOS,
  googleFontsHref,
  parseBannerStyle,
  parseExtraImages,
  type BannerFontKey,
  type BannerKind,
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
  const [eyebrow, setEyebrow] = useState(text(banner?.eyebrow, DEFAULT_BANNER_TEXTS.eyebrow));
  const [eyebrowHighlight, setEyebrowHighlight] = useState(
    text(banner?.eyebrow_highlight, DEFAULT_BANNER_TEXTS.eyebrowHighlight),
  );
  const [headline, setHeadline] = useState(
    text(banner?.headline_line1, DEFAULT_BANNER_TEXTS.headline),
  );
  const [highlight, setHighlight] = useState(
    text(banner?.headline_line2, DEFAULT_BANNER_TEXTS.highlight),
  );
  const [subtitle, setSubtitle] = useState(
    text(banner?.subtitle, DEFAULT_BANNER_TEXTS.subtitle),
  );
  const [ctaLabel, setCtaLabel] = useState(
    text(banner?.cta_label, DEFAULT_BANNER_TEXTS.ctaLabel),
  );
  const [ctaHref, setCtaHref] = useState(banner?.cta_href ?? DEFAULT_BANNER_TEXTS.ctaHref);
  const [showWhatsapp, setShowWhatsapp] = useState(banner?.show_whatsapp ?? true);
  const [whatsappLabel, setWhatsappLabel] = useState(
    banner?.whatsapp_label ?? DEFAULT_BANNER_TEXTS.whatsappLabel,
  );
  const [badge, setBadge] = useState(text(banner?.badge, DEFAULT_BANNER_TEXTS.badge));
  const [imageUrl, setImageUrl] = useState<string | null>(banner?.image_url ?? null);
  const [mobileImageUrl, setMobileImageUrl] = useState<string | null>(
    banner?.mobile_image_url ?? null,
  );
  // More photos that take turns behind the texts; each slot has a stable
  // key so removing one doesn't remount (and clean up) the others.
  const [extraSlots, setExtraSlots] = useState<{ key: number; url: string | null }[]>(() =>
    parseExtraImages(banner?.extra_images).map((url, index) => ({ key: index, url })),
  );
  const nextSlotKey = useRef(extraSlots.length);
  const extraImages = extraSlots.map((slot) => slot.url).filter((url): url is string => !!url);
  const [style, setStyle] = useState<BannerStyle>(() => parseBannerStyle(banner?.style));
  const [active, setActive] = useState(banner?.active ?? true);
  const [position, setPosition] = useState(banner?.position ?? 0);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");

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
    setStyle((current) => ({ ...current, [key]: value }));

  const preview: HeroBannerData = {
    id: banner?.id ?? "novo",
    kind,
    eyebrow,
    eyebrowHighlight,
    headline,
    highlight,
    subtitle,
    ctaLabel,
    ctaHref: ctaHref || "/colecao",
    showWhatsapp,
    whatsappLabel,
    badge,
    imageUrl,
    mobileImageUrl,
    extraImages: kind === "pronto" ? [] : extraImages,
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
        <input type="hidden" name="eyebrow" value={eyebrow} />
        <input type="hidden" name="eyebrow_highlight" value={eyebrowHighlight} />
        <input type="hidden" name="headline_line1" value={headline} />
        <input type="hidden" name="headline_line2" value={highlight} />
        <input type="hidden" name="subtitle" value={subtitle} />
        <input type="hidden" name="cta_label" value={ctaLabel} />
        <input type="hidden" name="cta_href" value={ctaHref} />
        <input type="hidden" name="whatsapp_label" value={whatsappLabel} />
        <input type="hidden" name="badge" value={badge} />
        <input type="hidden" name="image_url" value={imageUrl ?? ""} />
        <input type="hidden" name="mobile_image_url" value={mobileImageUrl ?? ""} />
        <input type="hidden" name="extra_images" value={JSON.stringify(extraImages)} />
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
            <Label htmlFor="position">Ordem no carrossel</Label>
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
              text="Foto de fundo, frases, fontes e cores pelo painel."
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
              A imagem aparece inteira, sem cortes. Tamanhos sugeridos: celular 1080 × 1350
              (em pé) e computador 1920 × 800 (deitada). Sem a do celular, ele usa a do
              computador.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <ImageUploader
                label="Celular"
                value={mobileImageUrl}
                onChange={setMobileImageUrl}
                folder="banners"
                aspect="aspect-[4/5]"
                savingRef={savingRef}
              />
              <ImageUploader
                label="Computador"
                value={imageUrl}
                onChange={setImageUrl}
                folder="banners"
                aspect="aspect-[12/5]"
                savingRef={savingRef}
              />
            </div>
            <Field id="ctaHref" label="Ao tocar, abre (link)">
              <Input id="ctaHref" value={ctaHref} onChange={(e) => setCtaHref(e.target.value)} placeholder="/colecao" />
            </Field>
            <Field id="headline" label="Descrição da imagem (para o Google e leitores de tela)">
              <Input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} />
            </Field>
          </Section>
        ) : (
          <>
            <Section title="Foto de fundo">
              <div className="grid grid-cols-2 gap-4">
                <ImageUploader
                  label="Foto (celular e computador)"
                  value={imageUrl}
                  onChange={setImageUrl}
                  folder="banners"
                  aspect="aspect-[4/5]"
                  savingRef={savingRef}
                />
                {/* Older banners may have a phone-only photo; it shows here so
                    it can be removed. New banners use one photo for both. */}
                {mobileImageUrl && (
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
              <p className="text-xs text-ink-muted">
                Uma foto serve para as duas versões: no celular ela fica em cima, com as frases
                embaixo; no computador, à direita, com as frases à esquerda, como na arte. Fotos
                com fundo escuro combinam melhor.
              </p>

              <div className="flex flex-col gap-3 rounded-lg border border-line p-4">
                <div>
                  <p className="text-sm font-semibold">Mais fotos (carrossel)</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    As fotos passam uma de cada vez atrás das mesmas frases, a cada 5 segundos.
                    Cada foto serve para celular e computador.
                  </p>
                </div>
                {extraSlots.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {extraSlots.map((slot, index) => (
                      <ImageUploader
                        key={slot.key}
                        label={`Foto ${index + 2}`}
                        value={slot.url}
                        onChange={(url) =>
                          setExtraSlots((slots) =>
                            url
                              ? slots.map((s) => (s.key === slot.key ? { ...s, url } : s))
                              : slots.filter((s) => s.key !== slot.key),
                          )
                        }
                        folder="banners"
                        aspect="aspect-[4/5]"
                        savingRef={savingRef}
                      />
                    ))}
                  </div>
                )}
                {extraSlots.length < MAX_BANNER_PHOTOS - 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="self-start"
                    disabled={extraSlots.some((slot) => !slot.url)}
                    onClick={() =>
                      setExtraSlots((slots) => [
                        ...slots,
                        { key: nextSlotKey.current++, url: null },
                      ])
                    }
                  >
                    <Plus className="size-4" aria-hidden="true" /> Adicionar foto
                  </Button>
                )}
              </div>
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
              <Field id="desktopLayout" label="Foto no computador">
                <NativeSelect
                  id="desktopLayout"
                  value={style.desktopLayout}
                  onChange={(value) => setStyleField("desktopLayout", value as BannerStyle["desktopLayout"])}
                  options={[
                    ["split", "À direita, textos à esquerda"],
                    ["full", "No fundo inteiro"],
                  ]}
                />
              </Field>
            </Section>

            <Section title="Frases">
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <Field id="eyebrow" label="Frase pequena">
                  <Input id="eyebrow" value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} />
                </Field>
                <Field id="eyebrowHighlight" label="Em destaque">
                  <Input
                    id="eyebrowHighlight"
                    value={eyebrowHighlight}
                    onChange={(e) => setEyebrowHighlight(e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-[1fr_140px] gap-3">
                <Field id="headline" label="Título">
                  <Input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} />
                </Field>
                <Field id="highlight" label="Final em destaque">
                  <Input id="highlight" value={highlight} onChange={(e) => setHighlight(e.target.value)} />
                </Field>
              </div>
              <Field id="subtitle" label="Texto de apoio">
                <Textarea
                  id="subtitle"
                  rows={3}
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field id="ctaLabel" label="Botão principal">
                  <Input id="ctaLabel" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
                </Field>
                <Field id="ctaHref" label="Link do botão">
                  <Input
                    id="ctaHref"
                    value={ctaHref}
                    onChange={(e) => setCtaHref(e.target.value)}
                    placeholder="/colecao"
                  />
                </Field>
              </div>
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
                  setStyle((current) => ({
                    ...DEFAULT_BANNER_STYLE,
                    focusMobile: current.focusMobile,
                    focusDesktop: current.focusDesktop,
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-label">Como fica no site</p>
          <div className="flex rounded-lg border border-line p-1" role="group" aria-label="Ver como">
            <DeviceButton active={device === "mobile"} onClick={() => setDevice("mobile")} icon={<Smartphone className="size-4" aria-hidden="true" />} label="Celular" />
            <DeviceButton active={device === "desktop"} onClick={() => setDevice("desktop")} icon={<Monitor className="size-4" aria-hidden="true" />} label="Computador" />
          </div>
        </div>
        <ScaledPreview width={device === "mobile" ? 390 : 1440} maxWidth={device === "mobile" ? 360 : undefined}>
          <HeroBanner
            banner={preview}
            whatsappHref={showWhatsapp ? PREVIEW_WHATSAPP : null}
            frameClass={device === "mobile" ? "h-[760px]" : "h-[760px]"}
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

function DeviceButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm transition-colors",
        active ? "bg-card text-fg" : "text-ink-muted hover:text-fg",
      )}
    >
      {icon}
      {label}
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
