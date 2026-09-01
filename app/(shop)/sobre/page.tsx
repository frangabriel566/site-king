import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/data/settings";

export const metadata: Metadata = {
  title: "Sobre",
  description: "Conheça a King Store: vestuário masculino editorial, feito para durar.",
};

export default async function AboutPage() {
  const settings = await getSiteSettings();

  return (
    <div className="px-8 py-20 md:px-12">
      <div className="mx-auto max-w-2xl">
        <p className="text-label mb-6">Sobre</p>
        <h1 className="text-display mb-12 text-[clamp(3rem,10vw,7rem)]">
          {settings.store_name}
        </h1>
        <div className="flex flex-col gap-6 text-sm leading-relaxed text-ink-muted">
          <p>
            A {settings.store_name} nasceu da vontade de vestir bem sem
            excesso: peças com corte preciso, tecidos de peso real e uma
            estética editorial — preto, branco, e o mínimo de ruído entre
            você e a roupa.
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
