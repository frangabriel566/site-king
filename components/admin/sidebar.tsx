"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  House,
  Image as ImageIcon,
  Shirt,
  Tag,
  Award,
  Boxes,
  Package,
  MessageCircle,
  Store,
  ChartColumn,
  Users,
  Ticket,
  Star,
  MessageSquareQuote,
  Settings,
  Plug,
  Eraser,
  UserCog,
  LogOut,
  ExternalLink,
  Menu,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { adminLogoutAction } from "@/lib/actions/admin-auth";
import { StoreLogo } from "@/components/store-logo";

/** The store's logo and name (Configurações), shown where the panel names
 * the store. */
type StoreBrand = { logoUrl: string | null; name: string };

/** The panel's pages, grouped by what the operator is doing, so twenty
 * links read as five short lists instead of one long column. */
const NAV_GROUPS = [
  {
    title: "Visão geral",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/analytics", label: "Analytics", icon: Activity },
      { href: "/admin/relatorios", label: "Relatórios", icon: ChartColumn },
    ],
  },
  {
    title: "Vendas",
    items: [
      { href: "/admin/pedidos", label: "Pedidos", icon: Package },
      { href: "/admin/pedidos-whatsapp", label: "Pedidos WhatsApp", icon: MessageCircle },
      { href: "/admin/vendas-loja", label: "Vendas na loja", icon: Store },
      { href: "/admin/clientes", label: "Clientes", icon: Users },
      { href: "/admin/cupons", label: "Cupons", icon: Ticket },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { href: "/admin/produtos", label: "Produtos", icon: Shirt },
      { href: "/admin/estoque", label: "Estoque", icon: Boxes },
      { href: "/admin/categorias", label: "Categorias", icon: Tag },
      { href: "/admin/marcas", label: "Marcas", icon: Award },
    ],
  },
  {
    title: "Loja online",
    items: [
      { href: "/admin/pagina-inicial", label: "Página inicial", icon: House },
      { href: "/admin/banners", label: "Banners", icon: ImageIcon },
      { href: "/admin/avaliacoes", label: "Avaliações", icon: Star },
      { href: "/admin/feedbacks", label: "Feedbacks", icon: MessageSquareQuote },
    ],
  },
  {
    title: "Sistema",
    items: [
      { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
      { href: "/admin/integracoes", label: "Integrações", icon: Plug },
      { href: "/admin/faxina", label: "Faxina de imagens", icon: Eraser },
      { href: "/admin/conta", label: "Conta", icon: UserCog },
    ],
  },
];


export function AdminSidebar({
  email,
  pendingWhatsApp,
  brand,
}: {
  email: string | null;
  pendingWhatsApp: number;
  brand: StoreBrand;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* barra superior do mobile — o painel fixo de 256px não cabe ao lado
          do conteúdo num celular, então abaixo de md ele vira gaveta e só
          este cabeçalho fica visível. */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-line bg-[var(--header-bg)] px-4 md:hidden print:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu do painel"
          className="-ml-2 p-2 text-ink-muted transition-colors duration-150 ease-out hover:text-fg"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <Link href="/admin" className="select-none">
          <StoreLogo
            logoUrl={brand.logoUrl}
            name={brand.name}
            imageClassName="h-7 max-w-[160px]"
            textClassName="text-sm font-extrabold uppercase tracking-[0.1em] text-fg"
          />
        </Link>
      </header>

      <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-sidebar md:flex print:hidden">
        <SidebarPanel
          pathname={pathname}
          email={email}
          pendingWhatsApp={pendingWhatsApp}
          brand={brand}
        />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="admin-theme gap-0 border-r border-line bg-sidebar p-0 text-fg"
        >
          <SheetTitle className="sr-only">Menu do painel</SheetTitle>
          <SidebarPanel
            pathname={pathname}
            pendingWhatsApp={pendingWhatsApp}
            email={email}
            brand={brand}
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
  pendingWhatsApp,
  brand,
  onNavigate,
}: {
  pathname: string;
  email: string | null;
  pendingWhatsApp: number;
  brand: StoreBrand;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-6">
        <div>
          <Link href="/admin" onClick={onNavigate} className="inline-block select-none">
            <StoreLogo
              logoUrl={brand.logoUrl}
              name={brand.name}
              imageClassName="h-8 max-w-[180px]"
              textClassName="text-sm font-extrabold uppercase tracking-[0.1em] text-fg"
            />
          </Link>
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

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-4 last:mb-0">
            <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              {group.title}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                // Exigir a barra mantém a ficha do pedido ("/admin/pedidos/<id>")
                // acesa sob "Pedidos" sem acender "Pedidos WhatsApp".
                const isActive =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 ease-out md:py-2 ${
                        isActive
                          ? "bg-fg font-semibold text-bg"
                          : "text-ink-muted hover:bg-[var(--accent-soft-hover)] hover:text-fg"
                      }`}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      {item.label}
                      {item.href === "/admin/pedidos-whatsapp" && pendingWhatsApp > 0 && (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--warning)] px-1.5 text-[11px] font-semibold text-white">
                          <span className="sr-only">
                            {pendingWhatsApp} pedidos aguardando WhatsApp
                          </span>
                          <span aria-hidden="true">{pendingWhatsApp}</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-3 py-4">
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:bg-[var(--accent-soft)] hover:text-fg"
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
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:bg-[var(--accent-soft)] hover:text-fg"
          >
            <LogOut className="size-4 shrink-0" aria-hidden="true" />
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
