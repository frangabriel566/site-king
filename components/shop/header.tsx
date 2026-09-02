"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Menu, User, ShoppingBag, X, Truck, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { count, toggle, isHydrated } = useCart();

  useEffect(() => {
    // Hysteresis (collapse past 56px, only re-expand back under 16px)
    // instead of one shared threshold — a single cutoff flips back and
    // forth on every tiny wobble around it (trackpad momentum, rubber-band
    // bounce at the top of the page), which visibly shakes the header
    // since each flip re-triggers the height/opacity transitions. A dead
    // zone between the two thresholds absorbs that jitter.
    const COLLAPSE_AT = 56;
    const EXPAND_AT = 16;
    let ticking = false;

    const evaluate = () => {
      ticking = false;
      const y = window.scrollY;
      setScrolled((prev) => {
        if (!prev && y > COLLAPSE_AT) return true;
        if (prev && y < EXPAND_AT) return false;
        return prev;
      });
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(evaluate);
    };

    evaluate();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-fg text-bg">
        {/* top thin bar — free shipping note + contact channel */}
        <div
          className={cn(
            "overflow-hidden border-b border-white/10 transition-[max-height,opacity] duration-200 ease-out",
            scrolled ? "max-h-0 opacity-0" : "max-h-9 opacity-100",
          )}
        >
          <div className="mx-auto flex h-9 max-w-[1400px] items-center justify-between gap-4 px-4 text-xs md:px-8">
            <p className="flex items-center gap-2 truncate">
              <Truck className="size-3.5 shrink-0" aria-hidden="true" />
              {settings.free_shipping_note ?? "Frete grátis em compras selecionadas"}
            </p>
            {settings.whatsapp && (
              <a
                href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="hidden shrink-0 items-center gap-2 hover:text-gold sm:flex"
              >
                <MessageCircle className="size-3.5" aria-hidden="true" />
                Fale conosco
              </a>
            )}
          </div>
        </div>

        {/* main bar — logo, search, account + bag */}
        <div
          className={cn(
            "mx-auto flex max-w-[1400px] items-center gap-4 px-4 transition-[height] duration-200 ease-out md:gap-8 md:px-8",
            scrolled ? "h-14" : "h-18",
          )}
        >
          <Link href="/" className="shrink-0">
            {settings.logo_url ? (
              <Image
                src={settings.logo_url}
                alt={settings.store_name}
                width={140}
                height={40}
                className="h-8 w-auto object-contain md:h-10"
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

          <div className="ml-auto flex items-center gap-4 md:gap-6">
            <Link
              href="/conta"
              className="hidden items-center gap-2 text-sm hover:text-gold sm:flex"
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
                <span className="absolute -right-2 -top-2 flex size-4 items-center justify-center rounded-full bg-alert text-[10px] font-bold text-white">
                  {count}
                </span>
              )}
              <span className="hidden lg:inline">Sacola</span>
            </button>
            <button
              type="button"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="size-6" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* mobile search — its own row, always visible */}
        <div className="border-t border-white/10 px-4 py-2 md:hidden">
          <HeaderSearch />
        </div>

        {/* category nav row */}
        <nav
          className={cn(
            "hidden overflow-hidden border-t border-white/10 transition-[max-height] duration-200 ease-out md:block",
            scrolled ? "max-h-0" : "max-h-11",
          )}
        >
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
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full max-w-full gap-0 border-l border-line bg-white p-0 text-fg sm:max-w-full"
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="flex h-16 items-center justify-between bg-fg px-6 text-bg">
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
