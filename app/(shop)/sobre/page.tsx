import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/data/settings";

export const metadata: Metadata = {
  title: "Sobre",
  description: "Conheça a King Store: vestuário masculino de qualidade, feito para durar.",
};

export default async function AboutPage() {
  const settings = await getSiteSettings();

  return (
    <div className="px-8 py-20 md:px-12">
      <div className="mx-auto max-w-2xl">
        <p className="mb-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sobre
        </p>
        <h1 className="mb-12 text-2xl font-bold text-fg md:text-3xl">
          {settings.store_name}
        </h1>
        <div className="flex flex-col gap-6 text-sm leading-relaxed text-ink-muted">
          <p>
            A {settings.store_name} nasceu da vontade de vestir bem sem
            excesso: peças com corte preciso, tecidos de peso real e um
            padrão consistente de qualidade, do primeiro clique até a
            entrega na sua porta.
          </p>
          <p>
            Cada coleção é pensada como uma edição limitada: menos peças,
            mais atenção a caimento, acabamento e durabilidade. Não
            perseguimos tendência — construímos um guarda-roupa que
            atravessa estações.
          </p>
          <p>
            Trabalhamos com fornecedores selecionados e processos de
            produção que priorizam qualidade sobre volume. É assim que
            sustentamos um padrão alto peça após peça.
          </p>
        </div>
      </div>
    </div>
  );
}
