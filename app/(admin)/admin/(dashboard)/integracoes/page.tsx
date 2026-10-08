import type { Metadata } from "next";
import Link from "next/link";
import { CopyValue, IntegrationCard } from "@/components/admin/integration-card";
import { getIntegrationsAdmin } from "@/lib/data/integrations";
import { saveMelhorEnvioAction, saveMercadoPagoAction } from "@/lib/actions/integrations";
import { formatCep, formatDateTime } from "@/lib/format";
import { getRequestOrigin } from "@/lib/site-url";

export const metadata: Metadata = { title: "Integrações — Painel" };

const PROVIDER_LABEL = { mercadopago: "Mercado Pago", melhorenvio: "Melhor Envio" } as const;

export default async function AdminIntegrationsPage() {
  const [data, origin] = await Promise.all([getIntegrationsAdmin(), getRequestOrigin()]);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || origin).replace(/\/+$/, "");
  const { sales } = data;
  const bothOn = sales.mercadoPagoActive && sales.melhorEnvioActive;

  const melhorEnvioBlocked = !data.originCepValid
    ? "Para ativar: cadastre o CEP de origem em Configurações."
    : data.missingPackage.length > 0
      ? `Para ativar: ${data.missingPackage.length} ${
          data.missingPackage.length === 1 ? "produto ativo está" : "produtos ativos estão"
        } sem peso ou medidas (lista abaixo).`
      : null;

  return (
    <div className="max-w-3xl">
      <p className="text-label mb-2">Painel</p>
      <h1 className="text-heading mb-2 text-3xl">Integrações</h1>
      <p className="mb-8 text-sm text-ink-muted">
        Pagamento online (Mercado Pago) e cálculo de frete com etiqueta
        (Melhor Envio). Desligar qualquer um volta o site para vendas pelo
        WhatsApp com frete a combinar, na hora.
      </p>

      <section className="mb-8 rounded-lg border border-line bg-card p-5">
        <p className="text-label mb-2">Modo de venda agora</p>
        <p className="text-xl font-semibold text-fg">
          {sales.checkoutOpen ? "Checkout com pagamento online ativo" : "Vendas só pelo WhatsApp"}
        </p>
        <ul className="mt-3 flex flex-col gap-1 text-sm text-ink-muted">
          <li>Mercado Pago: {sales.mercadoPagoActive ? "ativo" : "desligado"}</li>
          <li>Melhor Envio: {sales.melhorEnvioActive ? "ativo" : "desligado"}</li>
        </ul>
        {bothOn && !sales.checkoutOpen && (
          <p className="mt-3 text-sm text-fg">
            Os dois estão ativos. O checkout com pagamento online abre quando a
            cotação de frete no checkout entrar no site (próxima atualização);
            até lá as vendas seguem pelo WhatsApp.
          </p>
        )}
      </section>

      {!data.keyConfigured && (
        <section className="mb-8 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-5 text-sm text-fg">
          <p className="font-semibold">Falta a chave que protege os tokens</p>
          <p className="mt-1">
            Crie o secret <code>INTEGRATIONS_KEY</code> no Worker (o comando
            está no guia de operação). Sem ele, nada pode ser salvo aqui.
          </p>
        </section>
      )}

      <div className="flex flex-col gap-8">
        <IntegrationCard
          view={data.mercadopago}
          title="Mercado Pago"
          description="Cobrança online (cartão, Pix e boleto) no checkout. Use as credenciais de teste primeiro."
          environmentLabels={{ test: "Teste", production: "Produção" }}
          secretFields={[
            {
              name: "access_token",
              label: "Access Token",
              help: "Mercado Pago → Suas integrações → Credenciais. Começa com APP_USR- (ou TEST-).",
            },
            {
              name: "webhook_secret",
              label: "Assinatura secreta do webhook",
              help: "Mercado Pago → Webhooks. Confirma que os avisos de pagamento vêm mesmo do Mercado Pago.",
            },
          ]}
          keyConfigured={data.keyConfigured}
          saveAction={saveMercadoPagoAction}
        >
          <CopyValue
            label="URL do webhook (cole no Mercado Pago, evento Pagamentos)"
            value={`${siteUrl}/api/webhooks/mercadopago`}
          />
        </IntegrationCard>

        <IntegrationCard
          view={data.melhorenvio}
          title="Melhor Envio"
          description="Frete calculado pelo CEP e etiqueta no pedido. Teste no Sandbox antes da conta de produção."
          environmentLabels={{ test: "Sandbox", production: "Produção" }}
          secretFields={[
            {
              name: "token",
              label: "Token",
              help: "Melhor Envio → Integrações → Permissões de acesso → Gerar token (do mesmo ambiente).",
            },
          ]}
          emailField
          keyConfigured={data.keyConfigured}
          activationBlocked={melhorEnvioBlocked}
          saveAction={saveMelhorEnvioAction}
        >
          <p className="text-sm text-ink-muted">
            CEP de origem:{" "}
            <strong className="text-fg">
              {data.originCep ? formatCep(data.originCep) : "não cadastrado"}
            </strong>{" "}
            —{" "}
            <Link href="/admin/configuracoes" className="text-accent-light hover:underline">
              editar em Configurações
            </Link>
          </p>
          {data.missingPackage.length > 0 && (
            <div>
              <p className="mb-2 text-sm text-fg">
                Produtos ativos sem peso ou medidas — o Melhor Envio não ativa
                enquanto houver algum:
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                {data.missingPackage.map((product) => (
                  <li key={product.id}>
                    <Link
                      href={`/admin/produtos/${product.id}`}
                      className="text-accent-light hover:underline"
                    >
                      {product.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </IntegrationCard>
      </div>

      <section className="mt-10">
        <p className="text-label mb-3">Histórico de alterações</p>
        {data.log.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhuma alteração ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-card text-sm">
            {data.log.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-0.5 px-4 py-3">
                <span className="text-fg">
                  <strong>{PROVIDER_LABEL[entry.provider]}</strong> — {entry.action}
                </span>
                <span className="text-xs text-ink-muted">
                  {entry.actorEmail ?? "—"} · {formatDateTime(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
