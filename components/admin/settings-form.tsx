"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageUploader } from "@/components/admin/image-uploader";
import { updateSiteSettingsAction, type ActionResult } from "@/lib/actions/settings";
import { formatCep } from "@/lib/format";
import type { SiteSettings } from "@/lib/data/settings";

const initialState: ActionResult = { status: "idle" };

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const [state, formAction, pending] = useActionState(updateSiteSettingsAction, initialState);
  const [logoUrl, setLogoUrl] = useState<string | null>(settings.logo_url);
  const [announcementActive, setAnnouncementActive] = useState(settings.announcement_active);
  // Flipped right before a real submit so navigating away after saving
  // does not delete the logo this form just wrote — see ImageUploader.
  const savingRef = useRef(false);

  useEffect(() => {
    if (state.status === "error") savingRef.current = false;
    if (state.status === "error" && state.message) toast.error(state.message);
    if (state.status === "success") toast.success("Configurações salvas.");
  }, [state]);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        savingRef.current = true;
      }}
      className="flex max-w-2xl flex-col gap-10"
    >
      <input type="hidden" name="logo_url" value={logoUrl ?? ""} />

      <section>
        <p className="text-label mb-4">Loja</p>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="store_name">Nome da loja</Label>
            <Input
              id="store_name"
              name="store_name"
              required
              defaultValue={settings.store_name}
            />
          </div>
          <div className="w-40">
            <ImageUploader
              label="Logo"
              value={logoUrl}
              onChange={setLogoUrl}
              folder="brand"
              aspect="aspect-square"
              savingRef={savingRef}
            />
          </div>
        </div>
      </section>

      <section>
        <p className="text-label mb-4">Contato e redes</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input
              id="whatsapp"
              name="whatsapp"
              placeholder="5511999999999"
              defaultValue={settings.whatsapp ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={settings.email ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="instagram">Instagram</Label>
            <Input
              id="instagram"
              name="instagram"
              placeholder="@kingstore"
              defaultValue={settings.instagram ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tiktok">TikTok</Label>
            <Input
              id="tiktok"
              name="tiktok"
              placeholder="@kingstore"
              defaultValue={settings.tiktok ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="youtube">YouTube</Label>
            <Input
              id="youtube"
              name="youtube"
              placeholder="@kingstore"
              defaultValue={settings.youtube ?? ""}
            />
          </div>
        </div>
      </section>

      <section>
        <p className="text-label mb-4">Barra do hero e frete</p>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="shipping_note">Frase de envio</Label>
            <Input
              id="shipping_note"
              name="shipping_note"
              defaultValue={settings.shipping_note ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="free_shipping_note">Frase de frete grátis</Label>
            <Input
              id="free_shipping_note"
              name="free_shipping_note"
              defaultValue={settings.free_shipping_note ?? ""}
            />
          </div>
        </div>
      </section>

      <section>
        <p className="text-label mb-4">Faixa de anúncio</p>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="announcement">Texto</Label>
            <Textarea
              id="announcement"
              name="announcement"
              rows={2}
              defaultValue={settings.announcement ?? ""}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="announcement_active"
              name="announcement_active"
              checked={announcementActive}
              onCheckedChange={setAnnouncementActive}
            />
            <Label htmlFor="announcement_active">Exibir faixa no site</Label>
          </div>
        </div>
      </section>

      {/* Endereço de origem — sem ele o Melhor Envio não cota nem emite
          etiqueta. O CEP sozinho já basta para a cotação no carrinho; o
          resto (endereço completo + CPF/CNPJ) só é exigido na hora de
          comprar a etiqueta, que é quando os Correios pedem o remetente
          na declaração de conteúdo. */}
      <section>
        <p className="text-label mb-1">Endereço de origem (Melhor Envio)</p>
        <p className="mb-4 text-sm text-ink-muted">
          De onde as encomendas saem. O CEP alimenta o cálculo de frete no
          carrinho; os demais campos são exigidos para gerar a etiqueta.
        </p>
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="origin_cep">CEP de origem</Label>
              <Input
                id="origin_cep"
                name="origin_cep"
                placeholder="00000-000"
                inputMode="numeric"
                maxLength={9}
                defaultValue={formatCep(settings.origin_cep ?? "")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="origin_document">CPF/CNPJ da loja</Label>
              <Input
                id="origin_document"
                name="origin_document"
                placeholder="000.000.000-00"
                inputMode="numeric"
                autoComplete="off"
                defaultValue={settings.origin_document ?? ""}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_140px]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="origin_street">Rua</Label>
              <Input
                id="origin_street"
                name="origin_street"
                defaultValue={settings.origin_street ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="origin_number">Número</Label>
              <Input
                id="origin_number"
                name="origin_number"
                defaultValue={settings.origin_number ?? ""}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="origin_complement">Complemento</Label>
              <Input
                id="origin_complement"
                name="origin_complement"
                defaultValue={settings.origin_complement ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="origin_district">Bairro</Label>
              <Input
                id="origin_district"
                name="origin_district"
                defaultValue={settings.origin_district ?? ""}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_140px]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="origin_city">Cidade</Label>
              <Input
                id="origin_city"
                name="origin_city"
                defaultValue={settings.origin_city ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="origin_state">UF</Label>
              <Input
                id="origin_state"
                name="origin_state"
                placeholder="PI"
                maxLength={2}
                defaultValue={settings.origin_state ?? ""}
              />
            </div>
          </div>
        </div>
      </section>

      <Button type="submit" size="lg" disabled={pending} className="w-fit">
        {pending ? "Salvando…" : "Salvar configurações"}
      </Button>
    </form>
  );
}
