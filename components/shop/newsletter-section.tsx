import { Newsletter } from "./newsletter";

export function NewsletterSection() {
  return (
    <section className="border-t border-line px-8 py-24 md:px-12">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 text-center">
        <h2 className="text-heading text-4xl sm:text-5xl">Newsletter</h2>
        <div className="w-full max-w-md">
          <Newsletter />
        </div>
      </div>
    </section>
  );
}
