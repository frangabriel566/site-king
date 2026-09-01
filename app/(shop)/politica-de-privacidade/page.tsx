import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/data/settings";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Como a King Store coleta, usa e protege seus dados.",
};

export default async function PrivacyPolicyPage() {
  const settings = await getSiteSettings();

  return (
    <div className="px-8 py-20 md:px-12">
      <div className="mx-auto max-w-2xl">
        <p className="text-label mb-6">Institucional</p>
        <h1 className="text-heading mb-12 text-4xl sm:text-5xl">
          Política de privacidade
        </h1>

        <div className="flex flex-col gap-10 text-sm leading-relaxed text-ink-muted">
          <section>
            <h2 className="text-heading mb-3 text-lg text-fg">Dados que coletamos</h2>
            <p>
              Coletamos os dados que você fornece ao criar uma conta ou
              fazer um pedido — nome, e-mail, telefone, data de
              nascimento e endereço de entrega — além de dados de
              navegação, como páginas visitadas e itens na sacola,
              usados apenas para operar a loja.
            </p>
          </section>
          <section>
            <h2 className="text-heading mb-3 text-lg text-fg">Como usamos</h2>
            <p>
              Seus dados são usados para processar pedidos, calcular
              frete, enviar atualizações sobre o status da compra e,
              quando autorizado, comunicações de marketing. Nunca
              vendemos seus dados a terceiros.
            </p>
          </section>
          <section>
            <h2 className="text-heading mb-3 text-lg text-fg">Cookies</h2>
            <p>
              Usamos cookies essenciais para o funcionamento da sacola e
              da sessão de login, e cookies analíticos para entender o
              uso do site. Você pode gerenciar preferências de cookies no
              seu navegador a qualquer momento.
            </p>
          </section>
          <section>
            <h2 className="text-heading mb-3 text-lg text-fg">Seus direitos</h2>
            <p>
              Você pode solicitar acesso, correção ou exclusão dos seus
              dados pessoais a qualquer momento, conforme a Lei Geral de
              Proteção de Dados (LGPD).
            </p>
          </section>
          {settings.email && (
            <section>
              <h2 className="text-heading mb-3 text-lg text-fg">Contato</h2>
              <p>Para questões sobre privacidade, escreva para {settings.email}.</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
