"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageUploader } from "@/components/admin/image-uploader";
import { updateSiteSettingsAction, type ActionResult } from "@/lib/actions/settings";
import type { SiteSettings } from "@/lib/data/settings";

const initialState: ActionResult = { status: "idle" };

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const [state, formAction, pending] = useActionState(updateSiteSettingsAction, initialState);
  const [logoUrl, setLogoUrl] = useState<string | null>(settings.logo_url);
  const [announcementActive, setAnnouncementActive] = useState(settings.announcement_active);

  useEffect(() => {
    if (state.status === "error" && state.message) toast.error(state.message);
    if (state.status === "success") toast.success("Configurações salvas.");
  }, [state]);

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-10">
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
              className="rounded-none"
            />
          </div>
          <div className="w-40">
            <ImageUploader
              label="Logo"
              value={logoUrl}
              onChange={setLogoUrl}
              folder="brand"
              aspect="aspect-square"
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
              className="rounded-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={settings.email ?? ""}
              className="rounded-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="instagram">Instagram</Label>
            <Input
              id="instagram"
              name="instagram"
              placeholder="@kingstore"
              defaultValue={settings.instagram ?? ""}
              className="rounded-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tiktok">TikTok</Label>
            <Input
              id="tiktok"
              name="tiktok"
              placeholder="@kingstore"
              defaultValue={settings.tiktok ?? ""}
              className="rounded-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="youtube">YouTube</Label>
            <Input
              id="youtube"
              name="youtube"
              placeholder="@kingstore"
              defaultValue={settings.youtube ?? ""}
              className="rounded-none"
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
              className="rounded-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="free_shipping_note">Frase de frete grátis</Label>
            <Input
              id="free_shipping_note"
              name="free_shipping_note"
              defaultValue={settings.free_shipping_note ?? ""}
              className="rounded-none"
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
              className="rounded-none"
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

      <Button type="submit" size="lg" disabled={pending} className="w-fit">
        {pending ? "Salvando…" : "Salvar configurações"}
      </Button>
    </form>
  );
}
