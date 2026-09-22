import type { ReactNode } from "react";

/**
 * One numbered step of the product form. Steps all live on the same page
 * (no wizard gating) — the numbered circle is there to give the page an
 * order to follow, not to block anything.
 */
export function ProductFormSection({
  step,
  title,
  description,
  id,
  action,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  /** Anchor target for the publish-issue links (see PUBLISH_FIELD_ANCHORS). */
  id?: string;
  /** Optional control shown at the right of the header (e.g. a switch). */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-xl border border-line bg-surface p-4 md:p-6"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-light"
          >
            {step}
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-fg">{title}</h2>
            {description && <p className="mt-1 text-xs text-ink-muted">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}
