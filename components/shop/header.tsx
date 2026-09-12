"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, User, ShoppingBag, X, Truck, MessageCircle } from "lucide-react";
import { useCart } from "@/lib/cart/context";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { HeaderSearch } from "@/components/shop/header-search";
import type { Category } from "@/lib/data/categories";
import type { SiteSettings } from "@/lib/data/settings";

export function Header({
  settings,
  categories,
}: {
  settings: SiteSettings;
  categories: Category[];
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { count, toggle, isHydrated } = useCart();

  return (
    <>
      {/* top thin bar — free shipping note + contact channel. Plain
          document flow (not part of the sticky header below, not
          JS-controlled) so it scrolls away on its own the moment the page
          moves — a JS-driven height/opacity collapse here was animating a
          layout-affecting property on content sitting right above a
          `position: sticky` element, which is a known class of Chromium
          quirk: the browser can shift window.scrollY itself as a side
          effect of that reflow, which re-triggers the scroll listener and
          produces a visible flicker loop. Letting native scrolling do the
          hiding sidesteps the bug entirely — no listener, nothing to
          fight with. */}
      <div className="border-b border-white/10 bg-black text-bg">
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
              className="hidden shrink-0 items-center justify-self-end gap-2 hover:text-gold sm:flex"
            >
              <MessageCircle className="size-3.5" aria-hidden="true" />
              Fale conosco
            </a>
          ) : (
            <div aria-hidden="true" />
          )}
        </div>
      </div>

      {/* sticky header — logo, search, account + bag. Height is constant
          (no scroll-driven resize) for the same reason as above. */}
      <header className="sticky top-0 z-40 w-full bg-black text-bg">
        <div className="mx-auto grid h-16 max-w-[1400px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-4 md:flex md:gap-8 md:px-8">
          <button
            type="button"
            className="justify-self-start md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="size-6" aria-hidden="true" />
          </button>

          <Link href="/" className="col-start-2 shrink-0 justify-self-center">
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

          <div className="col-start-3 flex items-center justify-self-end gap-4 md:ml-auto md:gap-6">
            <Link
              href="/conta"
              aria-label="Entrar"
              className="flex items-center gap-2 text-sm hover:text-gold"
            >
              <User className="size-5" aria-hidden="true" />
              <span className="hidden lg:inline">Entrar</span>
            </Link>
            <button
              type="button"
              onClick={toggle}
              className="relative flex items-center gap-2 text-sm hover:text-gold"
              aria-label={`Abrir sacola${isHydrated && count > 0 ? `, ${count} ${count === 1 ? "item" : "itens"}` : ""}`}
            >
              <ShoppingBag className="size-5" aria-hidden="true" />
              {isHydrated && count > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-alert px-1 text-[10px] font-bold text-white">
                  {count > 99 ? "99+" : count}
                </span>
              )}
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
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full max-w-full gap-0 border-l border-line bg-white p-0 text-fg sm:max-w-full"
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="flex h-16 items-center justify-between bg-black px-6 text-bg">
            <span className="text-sm font-extrabold uppercase tracking-[0.08em] text-gold">
              {settings.store_name}
            </span>
            <button type="button" onClick={() => setMobileOpen(false)} aria-label="Fechar menu">
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
