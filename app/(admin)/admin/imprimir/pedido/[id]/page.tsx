import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOrderByIdAdmin, getOrderItemPhotos } from "@/lib/data/orders";
import { getSiteSettings } from "@/lib/data/settings";
import { ORDER_STATUS_LABEL } from "@/lib/constants";
import {
  formatCep,
  formatCurrency,
  formatDateTime,
  formatPhone,
  formatVariantLabel,
} from "@/lib/format";
import { orderSummaryLines, summaryFromOrder } from "@/lib/orders/summary";
import { formatCpf } from "@/lib/validations/cpf";
import { OrderItemThumb } from "@/components/admin/order-item-thumb";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Imprimir pedido — Painel" };

/**
 * A folha do pedido para imprimir (ou salvar em PDF): fica fora do layout
 * do painel, sem menu, em preto no branco, para ir junto com a separação
 * e a embalagem. Cada peça tem foto, cor, tamanho e um quadrado para
 * marcar quando for separada.
 *
 * O acesso é o mesmo do painel: getOrderByIdAdmin exige admin.
 */
export default async function PrintOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, settings] = await Promise.all([getOrderByIdAdmin(id), getSiteSettings()]);
  if (!order) notFound();
  const photos = await getOrderItemPhotos(order.order_items);

  const customer = order.customer_snapshot as {
    name?: string;
    email?: string | null;
    phone?: string;
    document?: string;
  } | null;
  const address = order.shipping_address as {
    street?: string;
    number?: string;
    complement?: string | null;
    district?: string;
    city?: string;
    state?: string;
    cep?: string;
    freight?: { name: string; company: string; days: number } | null;
  } | null;
  const phone = customer?.phone ?? order.customer_phone ?? null;
  const units = order.order_items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="min-h-dvh bg-white text-black print:min-h-0">
      <style>{`@page { size: A4; margin: 12mm; } @media print { html, body { background: #fff !important; } }`}</style>

      <div className="mx-auto max-w-[760px] px-4 py-6 print:max-w-none print:p-0">
        <div className="mb-6 flex items-center justify-end gap-3 print:hidden">
          <PrintButton />
        </div>

        <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-4">
          <div>
            <p className="text-xl font-bold uppercase tracking-wide">{settings.store_name}</p>
            {settings.whatsapp && (
              <p className="text-xs">WhatsApp {formatPhone(settings.whatsapp)}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">Pedido #{order.code ?? order.order_number}</p>
            <p className="text-xs">{formatDateTime(order.created_at)}</p>
            <p className="text-xs">
              {ORDER_STATUS_LABEL[order.status] ?? order.status}
              {order.payment_method ? ` · ${order.payment_method}` : ""}
            </p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-6 border-b border-black/30 py-4 text-sm">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider">Cliente</p>
            <p className="font-medium">{customer?.name ?? "—"}</p>
            {phone && <p>{formatPhone(phone)}</p>}
            {customer?.email && <p>{customer.email}</p>}
            {customer?.document && <p>CPF {formatCpf(customer.document)}</p>}
          </div>
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider">Entrega</p>
            {address?.street ? (
              <>
                <p>
                  {address.street}, {address.number}
                  {address.complement ? ` — ${address.complement}` : ""}
                </p>
                <p>
                  {address.district} · {address.city}/{address.state}
                </p>
                {address.cep && <p>CEP {formatCep(address.cep)}</p>}
                {address.freight && (
                  <p className="mt-1">
                    Envio: {[address.freight.company, address.freight.name].filter(Boolean).join(" ")}
                  </p>
                )}
              </>
            ) : (
              <p>A combinar</p>
            )}
            {order.tracking_code && <p className="mt-1">Rastreio: {order.tracking_code}</p>}
          </div>
        </section>

        <section className="py-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider">
            Itens ({units} {units === 1 ? "peça" : "peças"})
          </p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-black text-left text-[11px] uppercase">
                <th className="w-6 py-1" />
                <th className="py-1">Produto</th>
                <th className="py-1 text-center">Qtd.</th>
                <th className="py-1 text-right">Unit.</th>
                <th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.order_items.map((item) => {
                const variant = formatVariantLabel(item.color, item.size);
                return (
                  <tr key={item.id} className="break-inside-avoid border-b border-black/20">
                    <td className="py-2 align-middle">
                      <span className="block size-4 border border-black" aria-label="Separado" />
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-3">
                        <OrderItemThumb url={photos.get(item.id)} alt={item.name} size={48} />
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {variant && <p className="text-xs">{variant}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 text-center text-base font-bold">{item.qty}</td>
                    <td className="py-2 text-right">{formatCurrency(item.unit_price)}</td>
                    <td className="py-2 text-right">
                      {formatCurrency(item.unit_price * item.qty)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="ml-auto mt-3 flex w-64 flex-col gap-1 text-sm">
            {orderSummaryLines(summaryFromOrder(order)).map((line) => (
              <div
                key={line.kind}
                className={
                  line.kind === "total"
                    ? "mt-1 flex justify-between border-t border-black pt-1 text-base font-bold"
                    : "flex justify-between"
                }
              >
                <span>{line.label}</span>
                <span>{line.value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-2 border-t border-black/30 pt-3 text-sm">
          <p className="mb-6 text-[11px] font-bold uppercase tracking-wider">Observações</p>
          <div className="mb-5 border-b border-black/30" />
          <div className="border-b border-black/30" />
        </section>
      </div>
    </div>
  );
}
