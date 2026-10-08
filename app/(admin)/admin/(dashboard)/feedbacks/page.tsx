import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Images, Pencil, Plus, Star } from "lucide-react";
import { getFeedbacksAdmin } from "@/lib/data/feedbacks";
import { deleteFeedbackAction } from "@/lib/actions/feedbacks";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/admin/delete-button";
import { formatDate } from "@/lib/format";
import { FeedbackToggle } from "./feedback-toggle";

export const metadata: Metadata = { title: "Feedbacks — Painel" };

const STATUS_FILTERS = [
  { value: undefined, label: "Todos" },
  { value: "ativos", label: "Ativos" },
  { value: "inativos", label: "Inativos" },
];
const HOME_FILTERS = [
  { value: undefined, label: "Home: todos" },
  { value: "sim", label: "Na home" },
  { value: "nao", label: "Fora da home" },
];

function filterHref(params: { status?: string; home?: string }) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.home) query.set("home", params.home);
  const text = query.toString();
  return text ? `/admin/feedbacks?${text}` : "/admin/feedbacks";
}

function Pill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150 ease-out ${
        active
          ? "border-accent-solid bg-accent-solid text-white"
          : "border-line text-ink-muted hover:border-ink-muted hover:text-fg"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function AdminFeedbacksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; home?: string }>;
}) {
  const { status, home } = await searchParams;
  const feedbacks = await getFeedbacksAdmin({ status, home });

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-label mb-2">Painel</p>
          <h1 className="text-heading text-3xl">Feedbacks</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Depoimentos que aparecem no carrossel &quot;O que nossos clientes dizem&quot;.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/admin/feedbacks/novo">
            <Plus className="size-4" /> Novo feedback
          </Link>
        </Button>
      </div>

      <nav aria-label="Filtros" className="mb-5 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Pill key={filter.label} href={filterHref({ status: filter.value, home })} active={status === filter.value}>
            {filter.label}
          </Pill>
        ))}
        <span className="mx-1 w-px self-stretch bg-line" aria-hidden="true" />
        {HOME_FILTERS.map((filter) => (
          <Pill key={filter.label} href={filterHref({ status, home: filter.value })} active={home === filter.value}>
            {filter.label}
          </Pill>
        ))}
      </nav>

      {feedbacks.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {status || home ? "Nenhum feedback com esses filtros." : "Nenhum feedback cadastrado."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {feedbacks.map((feedback) => {
            const cover = feedback.feedback_images[0];
            return (
              <li
                key={feedback.id}
                className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-card p-4 md:gap-5"
              >
                <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded bg-field">
                  {cover ? (
                    <Image src={cover.url} alt="" fill unoptimized className="object-cover object-top" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] text-ink-muted">Texto</span>
                  )}
                  {feedback.feedback_images.length > 1 && (
                    <span className="absolute right-0.5 bottom-0.5 flex items-center gap-0.5 rounded bg-black/70 px-1 text-[10px] font-semibold text-white">
                      <Images className="size-3" aria-hidden="true" />
                      {feedback.feedback_images.length}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 basis-48">
                  <p className="flex flex-wrap items-center gap-x-2 text-sm">
                    <span className="font-medium">{feedback.customer_name}</span>
                    {feedback.rating !== null && (
                      <span role="img" className="flex items-center gap-0.5 text-warning" aria-label={`Nota ${feedback.rating} de 5`}>
                        {Array.from({ length: feedback.rating }, (_, i) => (
                          <Star key={i} className="size-3" fill="currentColor" aria-hidden="true" />
                        ))}
                      </span>
                    )}
                    {feedback.position !== null && (
                      <span className="text-xs text-ink-muted">#{feedback.position}</span>
                    )}
                  </p>
                  {feedback.text && <p className="line-clamp-1 text-xs text-ink-muted">{feedback.text}</p>}
                  <p className="text-xs text-ink-muted">
                    {[
                      feedback.product?.name ?? "Sem produto",
                      feedback.feedback_date ? formatDate(`${feedback.feedback_date}T12:00:00Z`) : null,
                      feedback.feedback_images.length > 0
                        ? `${feedback.feedback_images.length} ${feedback.feedback_images.length === 1 ? "imagem" : "imagens"}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs text-ink-muted">
                  <FeedbackToggle id={feedback.id} field="active" value={feedback.active} name={feedback.customer_name} />
                  Ativo
                </label>
                <label className="flex items-center gap-2 text-xs text-ink-muted">
                  <FeedbackToggle
                    id={feedback.id}
                    field="show_on_home"
                    value={feedback.show_on_home}
                    name={feedback.customer_name}
                  />
                  Home
                </label>
                <Button variant="ghost" size="icon-sm" asChild>
                  <Link href={`/admin/feedbacks/${feedback.id}`} aria-label={`Editar feedback de ${feedback.customer_name}`}>
                    <Pencil className="size-4" />
                  </Link>
                </Button>
                <DeleteButton
                  itemLabel="feedback"
                  description="O feedback e as imagens dele serão apagados. Para só tirar do site, desative."
                  action={deleteFeedbackAction.bind(null, feedback.id)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
