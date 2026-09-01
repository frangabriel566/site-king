import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrderForConfirmation } from "@/lib/data/orders";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Pedido" };

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando pagamento",
  paid: "Pago",
  processing: "Em preparação",
  shipped: "Enviado",
  delivered: "Entregue",
  canceled: "Cancelado",
};

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderForConfirmation(id);
  if (!order) notFound();

  const address = order.shipping_address as {
    street?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: string;
    state?: string;
    cep?: string;
  } | null;

  return (
    <div className="px-8 py-16 md:px-12">
      <div className="mx-auto max-w-2xl">
        <p className="text-label mb-3">Pedido confirmado</p>
        <h1 className="text-heading text-4xl">#{order.order_number}</h1>
        <p className="mt-3 text-sm text-ink-muted">
          {formatDateTime(order.created_at)} · {STATUS_LABEL[order.status] ?? order.status}
        </p>

        {order.status === "pending" && (
          <p className="mt-6 border border-line bg-[#111111] p-4 text-sm text-ink-muted">
            Assim que o pagamento for confirmado, você recebe um e-mail e o
            status deste pedido é atualizado automaticamente.
          </p>
        )}

        <div className="mt-10 border-y border-line py-6">
          <p className="text-label mb-4">Itens</p>
          <ul className="flex flex-col gap-4">
            {order.order_items.map((item) => (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <div>
                  <p>{item.name}</p>
                  <p className="text-xs text-ink-muted">
                    {item.color} · {item.size} · Qtd. {item.qty}
                  </p>
                </div>
                <span>{formatCurrency(item.unit_price * item.qty)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-muted">Subtotal</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted">Frete</span>
            <span>{order.shipping > 0 ? formatCurrency(order.shipping) : "Grátis"}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between">
              <span className="text-ink-muted">Desconto</span>
              <span>-{formatCurrency(order.discount)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-line pt-2 text-base">
            <span>Total</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
        </div>

        {address && (
          <div className="mt-10">
            <p className="text-label mb-3">Endereço de entrega</p>
            <p className="text-sm text-ink-muted">
              {address.street}, {address.number}
              {address.complement ? ` — ${address.complement}` : ""}
              <br />
              {address.district}, {address.city} — {address.state}
              <br />
              {address.cep}
            </p>
          </div>
        )}

        <Link href="/colecao" className="link-arrow mt-12">
          Continuar comprando →
        </Link>
      </div>
    </div>
  );
}
