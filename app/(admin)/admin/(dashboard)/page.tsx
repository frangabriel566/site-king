import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Dashboard — Painel" };

const QUICK_LINKS = [
  { href: "/admin/banners", label: "Banners" },
  { href: "/admin/produtos", label: "Produtos" },
  { href: "/admin/categorias", label: "Categorias" },
  { href: "/admin/pedidos", label: "Pedidos" },
];

export default function AdminDashboardPage() {
  return (
    <div>
      <p className="text-label mb-2">Painel</p>
      <h1 className="text-heading mb-8 text-3xl">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="border border-line px-5 py-8 text-sm transition-colors duration-150 ease-out hover:border-fg"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
