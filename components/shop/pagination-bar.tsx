import Link from "next/link";

function buildHref(searchParams: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value) params.set(key, value);
  }
  if (page > 1) params.set("pagina", String(page));
  else params.delete("pagina");
  const query = params.toString();
  return `/colecao${query ? `?${query}` : ""}`;
}

export function PaginationBar({
  page,
  totalPages,
  searchParams,
}: {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav
      aria-label="Paginação"
      className="mt-16 flex items-center justify-center gap-6"
    >
      {page > 1 && (
        <Link href={buildHref(searchParams, page - 1)} className="text-sm font-medium text-fg hover:text-gold-text">
          ← Anterior
        </Link>
      )}
      <ul className="flex items-center gap-2">
        {pages.map((p) => (
          <li key={p}>
            <Link
              href={buildHref(searchParams, p)}
              aria-current={p === page ? "page" : undefined}
              className={`flex size-8 items-center justify-center rounded-md text-sm ${
                p === page ? "bg-cta text-white" : "text-muted-foreground hover:text-fg"
              }`}
            >
              {p}
            </Link>
          </li>
        ))}
      </ul>
      {page < totalPages && (
        <Link href={buildHref(searchParams, page + 1)} className="text-sm font-medium text-fg hover:text-gold-text">
          Próxima →
        </Link>
      )}
    </nav>
  );
}
