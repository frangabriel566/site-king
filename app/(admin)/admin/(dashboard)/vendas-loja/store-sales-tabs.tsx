"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Plus, Users } from "lucide-react";

const TABS = [
  { href: "/admin/vendas-loja", label: "Resumo", icon: BarChart3 },
  { href: "/admin/vendas-loja/nova", label: "Nova baixa", icon: Plus },
  { href: "/admin/vendas-loja/clientes", label: "Clientes", icon: Users },
];

export function StoreSalesTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Vendas na loja" className="flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors duration-150 ease-out ${
              isActive
                ? "border-accent-solid font-medium text-fg"
                : "border-transparent text-ink-muted hover:text-fg"
            }`}
          >
            <Icon className={`size-4 ${isActive ? "text-accent-light" : ""}`} aria-hidden="true" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
