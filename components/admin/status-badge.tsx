import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

/**
 * Status colour in the panel is semantic, never decorative: blue means
 * "interactive" everywhere else, so a paid order or an archived product
 * must not borrow it. Each tone is a tinted wash of its own meaning
 * colour with a matching border, which keeps them legible on the card
 * surface without turning a table row into a block of colour.
 *
 * The label inside always spells the status out, so the colour is a
 * second signal rather than the only one.
 */
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "border-line-strong bg-surface-2 text-ink-muted",
  info: "border-[var(--accent)]/40 bg-accent-soft text-accent-light",
  success: "border-[var(--success)]/40 bg-[var(--success)]/12 text-[var(--success)]",
  warning: "border-[var(--warning)]/40 bg-[var(--warning)]/12 text-[var(--warning)]",
  danger: "border-[var(--danger)]/40 bg-[var(--danger)]/12 text-[var(--danger)]",
};

/** Order status (orders.status) — unchanged values, just their colour. */
export const ORDER_STATUS_TONE: Record<string, StatusTone> = {
  pending: "warning",
  paid: "success",
  processing: "info",
  shipped: "info",
  delivered: "success",
  canceled: "danger",
};

/** Product status (products.status). */
export const PRODUCT_STATUS_TONE: Record<string, StatusTone> = {
  active: "success",
  draft: "neutral",
  archived: "neutral",
};

export function StatusBadge({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: StatusTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Badge variant="outline" className={`${TONE_CLASS[tone]} ${className}`}>
      {children}
    </Badge>
  );
}

/** Ativo/Inativo toggles (banners, cupons, marcas, categorias). */
export function ActiveBadge({ active, labels }: { active: boolean; labels: [string, string] }) {
  return (
    <StatusBadge tone={active ? "success" : "neutral"}>
      {active ? labels[0] : labels[1]}
    </StatusBadge>
  );
}
