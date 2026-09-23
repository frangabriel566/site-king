"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Menu, User, ShoppingBag, X, Truck, MessageCircle } from "lucide-react";
import { useCart } from "@/lib/cart/context";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { HeaderSearch } from "@/components/shop/header-search";
import type { Category } from "@/lib/data/categories";
import type { SiteSettings } from "@/lib/data/settings";

declare global {
  interface Window {
    /** Installed by EARLY_TAP in app/(shop)/layout.tsx. Returns the
     *  control pressed before hydration, once, and uninstalls itself. */
    __khTapTake?: () => string | null;
  }
}

export function Header({
  settings,
  categories,
}: {
  settings: SiteSettings;
  categories: Category[];
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { count, open: openBag, isHydrated } = useCart();

  // The links inside the drawer close it themselves, but that misses
  // every other way the route can change — the back button above all,
  // which would otherwise drop someone on the new page with the menu
  // still over it and the body scroll still locked.
  const pathname = usePathname();
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  /**
   * The first tap, replayed.
   *
   * These two controls are the only things in the header that need
   * JavaScript to do anything, and on a mid-range phone the bundle does
   * not finish hydrating for two to four seconds after the header is
   * on screen and looking entirely ready. Every tap in that window used
   * to land on inert DOM and vanish — the measured cause of "the
   * buttons do nothing on mobile", and the reason it never reproduces on
   * a desktop that hydrates in a couple of hundred milliseconds.
   *
   * An inline script in the shop layout (EARLY_TAP) starts recording
   * before the bundle is even requested. All that is left to do here is
   * collect what it saw and act on it the moment this component is
   * live. It only ever holds the most recent press, and forgets it as
   * soon as the shopper scrolls or taps anything else, so a press that
   * was abandoned long ago never springs a drawer open by surprise.
   */
  useEffect(() => {
    const take = window.__khTapTake;
    if (!take) return;
    const intent = take();
    if (intent === "menu") setMobileOpen(true);
    else if (intent === "bag") openBag();
  }, [openBag]);

  return (
    <>
      {/* One sticky block: announcement bar, logo row and the mobile
          search row all pin together at `top: 0`, and nothing inside ever
          changes height while scrolling.

          The announcement bar used to sit in plain document flow above
          this, which meant the header spent its first ~37px of scroll
          travelling before it pinned. On iOS that travel is where the
          jumping came from: Safari resizes the visual viewport as its
          address bar collapses, and a sticky element still in its
          pre-pinned phase gets re-resolved against a viewport that moved
          under it — so the header visibly slid over the banner and the
          bar appeared to come back. Pinned from scroll 0 there is no
          travel phase left to go wrong.

          Hiding the bar on scroll would still be possible, but only with
          `transform: translateY(...)` on this whole block — never height
          or display, which is what caused an earlier reflow/flicker loop
          here. */}
      {/* `transform-gpu` (a plain translateZ(0)) pins this to its own
          compositing layer up front. WebKit otherwise promotes and
          re-promotes a sticky header as the page scrolls, and the
          hit-test region it keeps for that layer can lag a frame or more
          behind where the header is painted — which is what makes every
          control in it stop responding while still looking normal. */}
      <header className="sticky top-0 z-40 w-full transform-gpu bg-black text-bg">
        {/* `select-none` here is load-bearing on iOS, not cosmetic: with
            the text selectable, a tap that drifts even slightly — which
            is most real thumb taps — makes Safari start a selection on
            this line and raise the Copiar/Pesquisar/Traduzir callout
            instead of delivering the tap. The menu button sits directly
            under this bar, so that is what swallowed the presses. */}
        <div className="select-none border-b border-white/10">
          <div className="mx-auto grid h-9 max-w-[1400px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 text-xs md:px-8">
            <div aria-hidden="true" />
            <p className="flex items-center justify-center gap-2 truncate text-center">
              <Truck className="size-3.5 shrink-0" aria-hidden="true" />
              {settings.free_shipping_note ?? "Frete grátis em compras selecionadas"}
            </p>
            {settings.whatsapp ? (
              <a
                href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="hidden shrink-0 touch-manipulation items-center justify-self-end gap-2 hover:text-gold sm:flex"
              >
                <MessageCircle className="size-3.5" aria-hidden="true" />
                Fale conosco
              </a>
            ) : (
              <div aria-hidden="true" />
            )}
          </div>
        </div>

        <div className="mx-auto grid h-16 max-w-[1400px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 md:flex md:gap-8 md:px-8">
          {/* Icon buttons carry a 44px hit area (`size-11`, or `min-h-11`
              plus `px-3`) even though the glyph is 20–24px: a target the
              size of the icon alone is under half the width of a
              fingertip. The account link and the bag sit flush against
              each other with no gap between them, so the 4px `px-2.5`
              used to shave off each side was not cosmetic — it put the
              boundary between "go to my account" and "open the bag"
              inside the pad of one thumb, and a tap meant for one of
              them landed on the other. The negative margin cancels the
              extra padding so the icons still line up with the `px-4`
              gutter, `touch-manipulation` drops the browser's
              wait-for-double-tap delay, and `relative z-10` keeps a wide
              logo from ever covering them. */}
          <button
            type="button"
            className="relative z-10 -ml-2.5 flex size-11 touch-manipulation select-none items-center justify-center justify-self-start md:hidden"
            onClick={() => setMobileOpen(true)}
            data-tap-intent="menu"
            aria-label="Abrir menu"
          >
            <Menu className="size-6" aria-hidden="true" />
          </button>

          <Link href="/" className="col-start-2 shrink-0 select-none justify-self-center">
            {settings.logo_url ? (
              <Image
                src={settings.logo_url}
                alt={settings.store_name}
                width={174}
                height={58}
                className="h-14 w-auto object-contain"
                priority
              />
            ) : (
              <span className="text-lg font-extrabold uppercase tracking-[0.08em] text-gold">
                {settings.store_name}
              </span>
            )}
          </Link>

          <div className="hidden flex-1 md:block">
            <HeaderSearch className="max-w-xl" />
          </div>

          <div className="relative z-10 col-start-3 -mr-2.5 flex items-center justify-self-end md:ml-auto md:-mr-3">
            {/* A plain anchor, not next/link, and deliberately so: Link
                intercepts the click and hands the navigation to the
                router, so anything wrong with the router or with the
                click itself leaves the control dead. A bare href is the
                one thing on this header that cannot be broken by
                JavaScript — the browser navigates even with the bundle
                unloaded or erroring. The cost is a full page load on a
                link that gets used once a session. */}
            <a
              href="/conta"
              aria-label="Entrar"
              className="flex min-h-11 touch-manipulation select-none items-center gap-2 px-3 text-sm hover:text-gold"
            >
              <User className="size-5" aria-hidden="true" />
              <span className="hidden lg:inline">Entrar</span>
            </a>
            <button
              type="button"
              onClick={openBag}
              data-tap-intent="bag"
              className="flex min-h-11 touch-manipulation select-none items-center gap-2 px-3 text-sm hover:text-gold"
              aria-label={`Abrir sacola${isHydrated && count > 0 ? `, ${count} ${count === 1 ? "item" : "itens"}` : ""}`}
            >
              {/* The badge anchors to the glyph, not to the padded
                  button, so widening the hit area leaves it in place. */}
              <span className="relative flex items-center">
                <ShoppingBag className="size-5" aria-hidden="true" />
                {isHydrated && count > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-alert px-1 text-[10px] font-bold text-white">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </span>
              <span className="hidden lg:inline">Sacola</span>
            </button>
          </div>
        </div>

        {/* mobile search — its own row, always visible */}
        <div className="border-t border-white/10 px-4 py-2 md:hidden">
          <HeaderSearch />
        </div>
      </header>

      {/* category nav row — plain document flow, right after the sticky
          header. Scrolling past it makes it slide up behind the pinned
          header naturally; no JS, no height animation, no reflow risk. */}
      <nav className="hidden border-t border-white/10 bg-black text-bg md:block">
        <div className="mx-auto flex h-11 max-w-[1400px] items-center gap-7 px-8 text-xs font-medium uppercase tracking-wide">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/colecao?categoria=${category.slug}`}
              className="whitespace-nowrap transition-colors duration-150 ease-out hover:text-gold"
            >
              {category.name}
            </Link>
          ))}
        </div>
      </nav>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        {/* Deliberately *not* `w-full`, unlike the bag: the menu holds
            nothing but a column of short links, so it has no use for the
            last 56px, and giving them up is what makes "tap outside to
            close" mean anything. At full width there is no outside — the
            panel covers 360, 375 and 414px alike, the overlay is never
            reachable, and the X in the corner becomes the only way out.
            `max-w-sm` stops the strip growing into a gutter on a tablet. */}
        <SheetContent
          side="left"
          showCloseButton={false}
          className="storefront-theme w-[calc(100%-3.5rem)] max-w-sm gap-0 border-r border-line bg-white p-0 text-fg"
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="flex h-16 items-center justify-between bg-black px-6 text-bg">
            <span className="text-sm font-extrabold uppercase tracking-[0.08em] text-gold">
              {settings.store_name}
            </span>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
              className="-mr-2.5 flex size-11 touch-manipulation select-none items-center justify-center"
            >
              <X className="size-6" aria-hidden="true" />
            </button>
          </div>
          <nav className="flex flex-1 flex-col divide-y divide-line overflow-y-auto">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/colecao?categoria=${category.slug}`}
                onClick={() => setMobileOpen(false)}
                className="px-6 py-4 text-base font-medium"
              >
                {category.name}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-1 border-t border-line px-6 py-6">
            <Link href="/conta" onClick={() => setMobileOpen(false)} className="py-2 text-sm">
              Minha conta
            </Link>
            <Link href="/sobre" onClick={() => setMobileOpen(false)} className="py-2 text-sm">
              Sobre a King
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
