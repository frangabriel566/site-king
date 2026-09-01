import Link from "next/link";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 border border-line px-8 py-24 text-center">
      <p className="text-heading text-2xl">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-muted">{description}</p>}
      {actionLabel && actionHref && (
        <Link href={actionHref} className="link-arrow mt-4">
          {actionLabel} →
        </Link>
      )}
    </div>
  );
}
