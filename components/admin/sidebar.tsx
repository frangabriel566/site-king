"use client";

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
} from "lucide-react";
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

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-line bg-[#0a0a0a] print:hidden">
      <div className="border-b border-line px-6 py-6">
        <p className="text-sm font-extrabold uppercase tracking-[0.1em] text-fg">
          King Store
        </p>
        <p className="text-label mt-1">Painel administrativo</p>
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
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-colors duration-150 ease-out ${
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
    </aside>
  );
}
