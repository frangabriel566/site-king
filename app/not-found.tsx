import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-8 text-center text-fg">
      <p className="text-label mb-6">Erro 404</p>
      <h1 className="text-display text-[clamp(3rem,14vw,10rem)]">
        Página
        <br />
        não encontrada
      </h1>
      <p className="mt-8 max-w-md text-sm text-ink-muted">
        O que você procura não existe ou foi movido. Volte para a coleção e
        continue vestindo bem.
      </p>
      <Link href="/" className="link-arrow mt-12">
        Voltar para a home →
      </Link>
    </div>
  );
}
