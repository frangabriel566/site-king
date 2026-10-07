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
import { formatCep, formatCurrency } from "@/lib/format";
import { ANNOUNCEMENT_MAX_LENGTH, ANNOUNCEMENT_MAX_MESSAGES } from "@/lib/shop-config";
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
        <p className="text-label mb-1">Vitrine: preço, selos e confiança</p>
        <p className="mb-4 text-sm text-ink-muted">
          Aparecem nos cards, na página do produto e na sacola. Campo vazio = não
          mostrar — a loja nunca exibe uma condição que não foi definida aqui.
        </p>
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="installments_max">Parcelas sem juros</Label>
              <Input
                id="installments_max"
                name="installments_max"
                type="number"
                min={2}
                max={24}
                step={1}
                inputMode="numeric"
                placeholder="ex.: 3"
                defaultValue={settings.installments_max ?? ""}
              />
              <p className="text-xs text-ink-muted">
                Mostra &quot;3x de R$ 33,30 sem juros&quot;. Precisa bater com o que o
                Mercado Pago da loja oferece sem juros.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pix_discount_percent">Desconto no Pix (%)</Label>
              <Input
                id="pix_discount_percent"
                name="pix_discount_percent"
                inputMode="decimal"
                placeholder="ex.: 5"
                defaultValue={settings.pix_discount_percent ?? ""}
              />
              <p className="text-xs text-ink-muted">
                Mostra o preço no Pix. Só exibição: o checkout online não aplica o
                desconto sozinho — a loja precisa honrá-lo no pagamento.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="free_shipping_threshold">Frete grátis a partir de (R$)</Label>
              <Input
                id="free_shipping_threshold"
                name="free_shipping_threshold"
                inputMode="decimal"
                placeholder="ex.: 399"
                defaultValue={settings.free_shipping_threshold ?? ""}
              />
              <p className="text-xs text-ink-muted">
                Zera o frete no checkout a partir deste subtotal e alimenta a barra
                &quot;Faltam R$ X para frete grátis&quot; da sacola. Vazio: sem frete grátis.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new_product_days">Selo &quot;Novo&quot; por (dias)</Label>
              <Input
                id="new_product_days"
                name="new_product_days"
                type="number"
                min={1}
                max={365}
                step={1}
                inputMode="numeric"
                placeholder="ex.: 30"
                defaultValue={settings.new_product_days ?? ""}
              />
              <p className="text-xs text-ink-muted">
                Produtos cadastrados há até esse número de dias ganham o selo.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="low_stock_units">&quot;Últimas unidades&quot; com até (peças)</Label>
              <Input
                id="low_stock_units"
                name="low_stock_units"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder="ex.: 3"
                defaultValue={settings.low_stock_units ?? ""}
              />
              <p className="text-xs text-ink-muted">
                Soma o estoque de todas as cores e tamanhos do produto.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="exchange_note">Frase de trocas</Label>
            <Input
              id="exchange_note"
              name="exchange_note"
              maxLength={80}
              placeholder="ex.: Primeira troca grátis em até 30 dias"
              defaultValue={settings.exchange_note ?? ""}
            />
            <p className="text-xs text-ink-muted">
              Também entra na faixa de benefícios da home, ao lado do WhatsApp e das
              parcelas sem juros (cada um só quando está preenchido).
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="secure_purchase_note">Frase de compra segura</Label>
            <Input
              id="secure_purchase_note"
              name="secure_purchase_note"
              maxLength={80}
              placeholder="ex.: Pagamento processado pelo Mercado Pago"
              defaultValue={settings.secure_purchase_note ?? ""}
            />
            <p className="text-xs text-ink-muted">
              As duas frases e a de frete grátis (acima) formam a faixa de confiança
              embaixo do botão de compra.
            </p>
          </div>
        </div>
      </section>

      <section>
        <p className="text-label mb-1">Faixa de avisos (topo do site)</p>
        <p className="mb-4 text-sm text-ink-muted">
          As mensagens se revezam a cada 5 segundos, acima do logo, em todas as páginas
          da loja. Desligada ou sem mensagens, a faixa mostra a regra de frete grátis
          (se houver uma).
        </p>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="announcement">Mensagens — uma por linha</Label>
            <Textarea
              id="announcement"
              name="announcement"
              rows={4}
              placeholder={"Frete grátis acima de R$ 199\nTroca fácil em até 30 dias\nParcele em até 3x sem juros"}
              defaultValue={settings.announcement ?? ""}
            />
            <p className="text-xs text-ink-muted">
              Até {ANNOUNCEMENT_MAX_MESSAGES} mensagens de até {ANNOUNCEMENT_MAX_LENGTH}{" "}
              caracteres. Com até uns 40 caracteres a mensagem cabe inteira no celular.
              {settings.free_shipping_threshold
                ? ` Ao falar de frete grátis, use o valor configurado acima (${formatCurrency(
                    settings.free_shipping_threshold,
                  )}) — é ele que o checkout aplica.`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="announcement_active"
              name="announcement_active"
              checked={announcementActive}
              onCheckedChange={setAnnouncementActive}
            />
            <Label htmlFor="announcement_active">Exibir estas mensagens no site</Label>
          </div>
        </div>
      </section>

      <section>
        <p className="text-label mb-1">Rodapé</p>
        <p className="mb-4 text-sm text-ink-muted">
          Os selos da última linha do rodapé, em todas as páginas da loja. Campo vazio =
          o selo não aparece.
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="footer_payment_text">Formas de pagamento</Label>
            <Input
              id="footer_payment_text"
              name="footer_payment_text"
              maxLength={40}
              placeholder="ex.: Cartão, Pix e boleto"
              defaultValue={settings.footer_payment_text ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="footer_security_text">Segurança</Label>
            <Input
              id="footer_security_text"
              name="footer_security_text"
              maxLength={40}
              placeholder="ex.: Compra segura"
              defaultValue={settings.footer_security_text ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="footer_privacy_text">Privacidade</Label>
            <Input
              id="footer_privacy_text"
              name="footer_privacy_text"
              maxLength={40}
              placeholder="ex.: Dados protegidos"
              defaultValue={settings.footer_privacy_text ?? ""}
            />
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
