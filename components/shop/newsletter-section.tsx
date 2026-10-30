import { Newsletter } from "./newsletter";

/** "Fique por dentro" (King Store layout, out/2026): title on the left, the
 * sign-up form on the right, between two hairlines. */
export function NewsletterSection() {
  return (
    <section className="mx-auto max-w-[1400px] px-4 py-14 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-6 border-y border-line py-9">
        <div className="min-w-0 flex-[1_1_360px]">
          <h2 className="mb-1.5 text-2xl md:text-[28px]">Fique por dentro</h2>
          <p className="text-[15px] text-muted-foreground">
            Lançamentos, ofertas e cupons exclusivos no seu e-mail.
          </p>
        </div>
        <div className="min-w-0 flex-[1_1_400px]">
          <Newsletter />
        </div>
      </div>
    </section>
  );
}
