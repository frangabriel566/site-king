import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FeedbackForm } from "@/components/admin/feedback-form";
import { updateFeedbackAction } from "@/lib/actions/feedbacks";
import { getFeedbackByIdAdmin } from "@/lib/data/feedbacks";
import { getProductOptions } from "@/lib/data/products";

export const metadata: Metadata = { title: "Editar feedback — Painel" };

export default async function EditFeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [feedback, products] = await Promise.all([getFeedbackByIdAdmin(id), getProductOptions()]);
  if (!feedback) notFound();

  return (
    <div>
      <p className="text-label mb-2">Feedbacks</p>
      <h1 className="text-heading mb-8 text-3xl">Editar feedback</h1>
      <FeedbackForm
        feedback={feedback}
        products={products.map(({ id: productId, name }) => ({ id: productId, name }))}
        action={updateFeedbackAction.bind(null, feedback.id)}
      />
    </div>
  );
}
