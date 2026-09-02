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
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-line bg-surface px-8 py-24 text-center">
      <p className="text-xl font-bold text-fg">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {actionLabel && actionHref && (
        <Link href={actionHref} className="link-arrow mt-4">
          {actionLabel} →
        </Link>
      )}
    </div>
  );
}
