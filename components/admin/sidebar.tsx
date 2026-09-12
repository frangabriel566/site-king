"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Image as ImageIcon,
  Shirt,
  Tag,
  Award,
  Boxes,
  Package,
  Users,
  Ticket,
  Star,
  Settings,
  LogOut,
  ExternalLink,
  Menu,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { adminLogoutAction } from "@/lib/actions/admin-auth";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/banners", label: "Banners", icon: ImageIcon },
  { href: "/admin/produtos", label: "Produtos", icon: Shirt },
  { href: "/admin/categorias", label: "Categorias", icon: Tag },
  { href: "/admin/marcas", label: "Marcas", icon: Award },
  { href: "/admin/estoque", label: "Estoque", icon: Boxes },
  { href: "/admin/pedidos", label: "Pedidos", icon: Package },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/cupons", label: "Cupons", icon: Ticket },
  { href: "/admin/avaliacoes", label: "Avaliações", icon: Star },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

export function AdminSidebar({ email }: { email: string | null }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* barra superior do mobile — o painel fixo de 256px não cabe ao lado
          do conteúdo num celular, então abaixo de md ele vira gaveta e só
          este cabeçalho fica visível. */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-line bg-[#0a0a0a] px-4 md:hidden print:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu do painel"
          className="-ml-2 p-2 text-ink-muted transition-colors duration-150 ease-out hover:text-fg"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <p className="text-sm font-extrabold uppercase tracking-[0.1em] text-fg">
          King Store
        </p>
      </header>

      <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-[#0a0a0a] md:flex print:hidden">
        <SidebarPanel pathname={pathname} email={email} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="gap-0 border-r border-line bg-[#0a0a0a] p-0 text-fg"
        >
          <SheetTitle className="sr-only">Menu do painel</SheetTitle>
          <SidebarPanel
            pathname={pathname}
            email={email}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

// Mesmo conteúdo nos dois modos: coluna fixa no desktop, gaveta no mobile.
// `onNavigate` só é passado na gaveta — é o que fecha o menu ao navegar.
function SidebarPanel({
  pathname,
  email,
  onNavigate,
}: {
  pathname: string;
  email: string | null;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-6">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.1em] text-fg">
            King Store
          </p>
          <p className="text-label mt-1">Painel administrativo</p>
        </div>
        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Fechar menu"
            className="-mr-2 -mt-1 p-2 text-ink-muted transition-colors duration-150 ease-out hover:text-fg"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 px-3 py-3 text-sm transition-colors duration-150 ease-out md:py-2.5 ${
                    isActive
                      ? "bg-white text-black"
                      : "text-ink-muted hover:bg-[#161616] hover:text-fg"
                  }`}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-line px-3 py-4">
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:bg-[#161616] hover:text-fg"
        >
          <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
          Ver loja
        </a>
        {email && (
          <p className="truncate px-3 pt-3 text-xs text-ink-muted">{email}</p>
        )}
        <form action={adminLogoutAction}>
          <button
            type="submit"
            className="mt-1 flex w-full items-center gap-3 px-3 py-2.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:bg-[#161616] hover:text-fg"
          >
            <LogOut className="size-4 shrink-0" aria-hidden="true" />
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
