import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/data/settings";

export const metadata: Metadata = {
  title: "Trocas e devoluções",
  description: "Política de trocas e devoluções da King Store.",
};

export default async function ExchangesPage() {
  const settings = await getSiteSettings();

  return (
    <div className="px-8 py-20 md:px-12">
      <div className="mx-auto max-w-2xl">
        <p className="mb-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Institucional
        </p>
        <h1 className="mb-12 text-2xl font-bold text-fg md:text-3xl">
          Trocas e devoluções
        </h1>

        <div className="flex flex-col gap-10 text-sm leading-relaxed text-ink-muted">
          <section>
            <h2 className="mb-3 text-lg font-bold text-fg">Prazo</h2>
            <p>
              Você tem até 30 dias corridos após o recebimento do pedido
              para solicitar troca ou devolução, conforme o Código de
              Defesa do Consumidor.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-bold text-fg">Condições</h2>
            <p>
              As peças devem ser devolvidas sem uso, com etiquetas
              originais e na embalagem original. Itens em promoção também
              podem ser trocados ou devolvidos dentro do mesmo prazo.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-bold text-fg">Como solicitar</h2>
            <p>
              Entre em contato pelo WhatsApp ou e-mail informando o número
              do pedido. Nossa equipe envia as instruções de postagem e
              acompanha o processo até a confirmação da troca ou do
              reembolso.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-bold text-fg">Reembolso</h2>
            <p>
              Após recebermos e conferirmos a peça devolvida, o reembolso
              é processado em até 10 dias úteis, no mesmo método de
              pagamento utilizado na compra.
            </p>
          </section>
          {(settings.whatsapp || settings.email) && (
            <section>
              <h2 className="mb-3 text-lg font-bold text-fg">Contato</h2>
              <p>
                {settings.email && <>E-mail: {settings.email}<br /></>}
                {settings.whatsapp && <>WhatsApp: {settings.whatsapp}</>}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
