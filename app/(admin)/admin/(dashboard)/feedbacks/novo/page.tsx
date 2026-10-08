import type { Metadata } from "next";
import { FeedbackForm } from "@/components/admin/feedback-form";
import { createFeedbackAction } from "@/lib/actions/feedbacks";
import { getProductOptions } from "@/lib/data/products";

export const metadata: Metadata = { title: "Novo feedback — Painel" };

export default async function NewFeedbackPage() {
  const products = await getProductOptions();
  return (
    <div>
      <p className="text-label mb-2">Feedbacks</p>
      <h1 className="text-heading mb-8 text-3xl">Novo feedback</h1>
      <FeedbackForm
        products={products.map(({ id, name }) => ({ id, name }))}
        action={createFeedbackAction}
      />
    </div>
  );
}
