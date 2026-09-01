"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Menu, Search, User, ShoppingBag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cart/context";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { Category } from "@/lib/data/categories";

const SearchOverlay = dynamic(
  () => import("./search-overlay").then((mod) => mod.SearchOverlay),
  { ssr: false },
);

export function Header({
  storeName,
  categories,
}: {
  storeName: string;
  categories: Category[];
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { count, toggle, isHydrated } = useCart();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 w-full transition-colors duration-200 ease-out",
          scrolled
            ? "border-b border-line bg-bg/90 backdrop-blur-md"
            : "border-b border-transparent bg-transparent",
        )}
      >
        <div className="flex h-16 items-center justify-between px-8 md:px-12">
          <div className="flex items-center gap-10">
            <Link
              href="/"
              className="text-sm font-extrabold uppercase tracking-[0.1em] text-fg"
            >
              {storeName}
            </Link>
            <nav className="hidden items-center gap-6 md:flex">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/colecao?categoria=${category.slug}`}
                  className="text-label transition-colors duration-200 ease-out hover:!text-gold"
                >
                  {category.name}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="text-label flex items-center gap-2 transition-colors duration-200 ease-out hover:!text-gold"
              aria-label="Buscar"
            >
              <Search className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Buscar</span>
            </button>
            <Link
              href="/conta"
              className="text-label hidden items-center gap-2 transition-colors duration-200 ease-out hover:!text-gold sm:flex"
            >
              <User className="size-4" aria-hidden="true" />
              Conta
            </Link>
            <button
              type="button"
              onClick={toggle}
              className="text-label flex items-center gap-2 transition-colors duration-200 ease-out hover:!text-gold"
              aria-label={`Abrir sacola${isHydrated && count > 0 ? `, ${count} ${count === 1 ? "item" : "itens"}` : ""}`}
            >
              <ShoppingBag className="size-4" aria-hidden="true" />
              <span>Sacola{isHydrated && count > 0 ? ` (${count})` : ""}</span>
            </button>
            <button
              type="button"
              className="text-fg md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full max-w-full gap-0 border-l border-line bg-bg p-0 sm:max-w-full"
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="flex h-16 items-center justify-between px-8">
            <span className="text-sm font-extrabold uppercase tracking-[0.1em] text-fg">
              {storeName}
            </span>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
            >
              <X className="size-6 text-fg" aria-hidden="true" />
            </button>
          </div>
          <div className="hairline mx-8" />
          <nav className="flex flex-1 flex-col justify-center gap-2 px-8">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/colecao?categoria=${category.slug}`}
                onClick={() => setMobileOpen(false)}
                className="text-heading py-3 text-3xl text-fg"
              >
                {category.name}
              </Link>
            ))}
          </nav>
          <div className="hairline mx-8" />
          <div className="flex flex-col gap-4 px-8 py-8">
            <Link
              href="/conta"
              onClick={() => setMobileOpen(false)}
              className="link-arrow"
            >
              Minha conta →
            </Link>
            <Link
              href="/sobre"
              onClick={() => setMobileOpen(false)}
              className="link-arrow"
            >
              Sobre a King →
            </Link>
          </div>
        </SheetContent>
      </Sheet>

      <SearchOverlay open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
