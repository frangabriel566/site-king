"use client";

import { useActionState, useEffect, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitReviewAction, type ActionResult } from "@/lib/actions/reviews";
import { formatDate, formatReviewerName } from "@/lib/format";
import type { Review } from "@/lib/data/reviews";

const initialState: ActionResult = { status: "idle" };

export function ProductReviews({
  productId,
  slug,
  reviews,
  average,
  count,
}: {
  productId: string;
  slug: string;
  reviews: Review[];
  average: number;
  count: number;
}) {
  const [state, formAction, pending] = useActionState(submitReviewAction, initialState);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => {
    if (state.status === "error" && state.message) toast.error(state.message);
    if (state.status === "success") {
      toast.success("Obrigado pela sua avaliação!");
      setRating(0);
    }
  }, [state]);

  return (
    <section id="avaliacoes" className="scroll-mt-24">
      <h2 className="mb-4 text-lg font-bold text-fg">Avaliações</h2>
      <div className="flex flex-col gap-6 rounded-lg border border-line bg-surface p-6">
        <div className="flex items-center gap-3">
          <StarRow value={average} />
          {count > 0 ? (
            <p className="text-sm text-muted-foreground">
              {average.toFixed(1)} · {count} {count === 1 ? "avaliação" : "avaliações"}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Este produto ainda não tem avaliações.
            </p>
          )}
        </div>

        {reviews.length > 0 && (
          <ul className="flex flex-col gap-4 border-t border-line pt-6">
            {reviews.map((review) => (
              <li key={review.id} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StarRow value={review.rating} size="sm" />
                  <span className="text-sm font-medium text-fg">
                    {review.customer ? formatReviewerName(review.customer.name) : "Cliente"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(review.created_at)}
                  </span>
                </div>
                {review.comment && <p className="text-sm text-fg">{review.comment}</p>}
              </li>
            ))}
          </ul>
        )}

        <form action={formAction} className="flex flex-col gap-3 border-t border-line pt-6">
          <input type="hidden" name="product_id" value={productId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="rating" value={rating} />

          <p className="text-sm font-medium text-fg">Deixe sua avaliação</p>
          <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
            {Array.from({ length: 5 }, (_, i) => {
              const value = i + 1;
              const filled = value <= (hoverRating || rating);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  onMouseEnter={() => setHoverRating(value)}
                  aria-label={`${value} ${value > 1 ? "estrelas" : "estrela"}`}
                  aria-pressed={rating === value}
                >
                  <Star
                    className={`size-6 ${filled ? "fill-gold text-gold" : "text-line"}`}
                    strokeWidth={1.5}
                  />
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="review-comment">Comentário (opcional)</Label>
            <Textarea
              id="review-comment"
              name="comment"
              rows={3}
              maxLength={1000}
              placeholder="Conte como foi sua experiência com o produto"
            />
          </div>

          <Button type="submit" size="lg" className="w-fit" disabled={pending || rating === 0}>
            {pending ? "Enviando…" : "Enviar avaliação"}
          </Button>
        </form>
      </div>
    </section>
  );
}

function StarRow({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "size-4" : "size-5";
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`${cls} ${i < Math.round(value) ? "fill-gold text-gold" : "text-line"}`}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}
