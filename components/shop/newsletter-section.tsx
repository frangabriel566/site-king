import { Newsletter } from "./newsletter";

export function NewsletterSection() {
  return (
    <section className="border-t border-line bg-surface px-4 py-12 md:px-8">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
        <h2 className="text-xl font-bold text-fg md:text-2xl">
          Fique por dentro das novidades
        </h2>
        <p className="text-sm text-muted-foreground">
          Lançamentos, ofertas e cupons exclusivos direto no seu e-mail.
        </p>
        <div className="w-full max-w-md">
          <Newsletter />
        </div>
      </div>
    </section>
  );
}
