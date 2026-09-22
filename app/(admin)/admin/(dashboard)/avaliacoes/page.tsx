import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { getAllReviewsAdmin } from "@/lib/data/reviews";
import { deleteReviewAdminAction } from "@/lib/actions/reviews";
import { formatDate, formatReviewerName } from "@/lib/format";
import { DeleteButton } from "@/components/admin/delete-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Avaliações — Painel" };

export default async function AdminReviewsPage() {
  const reviews = await getAllReviewsAdmin();

  return (
    <div>
      <div className="mb-8">
        <p className="text-label mb-2">Painel</p>
        <h1 className="text-heading text-3xl">Avaliações</h1>
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-ink-muted">Nenhuma avaliação ainda.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-line hover:bg-transparent">
              <TableHead>Produto</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Nota</TableHead>
              <TableHead>Comentário</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviews.map((review) => (
              <TableRow key={review.id} className="border-line">
                <TableCell>
                  {review.product ? (
                    <Link
                      href={`/produto/${review.product.slug}`}
                      target="_blank"
                      className="hover:text-accent-light"
                    >
                      {review.product.name}
                    </Link>
                  ) : (
                    <span className="text-ink-muted">Produto removido</span>
                  )}
                </TableCell>
                <TableCell className="text-ink-muted">
                  {review.customer ? formatReviewerName(review.customer.name) : "Cliente"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        // Amber, not the panel's blue: a rating star is a
                        // rating star everywhere, and blue here would read as
                        // "selected" rather than "scored".
                        className={`size-4 ${
                          i < review.rating
                            ? "fill-[var(--warning)] text-[var(--warning)]"
                            : "text-line-strong"
                        }`}
                        strokeWidth={1.5}
                      />
                    ))}
                  </div>
                </TableCell>
                <TableCell className="max-w-xs truncate text-ink-muted" title={review.comment ?? ""}>
                  {review.comment || "—"}
                </TableCell>
                <TableCell className="text-ink-muted">{formatDate(review.created_at)}</TableCell>
                <TableCell className="text-right">
                  <DeleteButton
                    itemLabel="avaliação"
                    action={deleteReviewAdminAction.bind(null, review.id, review.product?.slug ?? "")}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
