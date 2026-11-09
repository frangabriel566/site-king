import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOrderByIdAdmin } from "@/lib/data/orders";
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
import { PrintButton, ThermalPageSize } from "./print-button";

export const metadata: Metadata = { title: "Imprimir pedido — Painel" };

/**
 * A notinha do pedido, para a impressora térmica de bobina 80 mm: fica fora
 * do layout do painel, sem menu, em preto puro e letra grande — a térmica
 * não imprime cinza. Sem foto (na térmica vira um borrão preto). Cada peça
 * tem cor, tamanho e um quadrado para marcar quando for separada.
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

  const label = "text-[12px] font-extrabold uppercase tracking-wide";
  const divider = "border-t-2 border-dashed border-black";

  return (
    <div className="min-h-dvh bg-white text-black print:min-h-0">
      <ThermalPageSize ticketId="notinha" />

      <div className="flex justify-center py-4 print:hidden">
        <PrintButton />
      </div>

      <main
        id="notinha"
        className="mx-auto box-border w-[80mm] px-[4mm] py-[3mm] text-[14px] leading-snug font-semibold [overflow-wrap:anywhere]"
      >
        <header className="pb-2 text-center">
          <p className="text-[22px] font-black tracking-wide uppercase">{settings.store_name}</p>
          {settings.whatsapp && <p>WhatsApp {formatPhone(settings.whatsapp)}</p>}
        </header>

        <section className={`${divider} py-2 text-center`}>
          <p className="text-[22px] font-black">Pedido #{order.code ?? order.order_number}</p>
          <p>{formatDateTime(order.created_at)}</p>
          <p>
            {ORDER_STATUS_LABEL[order.status] ?? order.status}
            {order.payment_method ? ` · ${order.payment_method}` : ""}
          </p>
        </section>

        <section className={`${divider} py-2`}>
          <p className={label}>Cliente</p>
          <p className="font-bold">{customer?.name ?? "—"}</p>
          {phone && <p>{formatPhone(phone)}</p>}
          {customer?.email && <p>{customer.email}</p>}
          {customer?.document && <p>CPF {formatCpf(customer.document)}</p>}
        </section>

        <section className={`${divider} py-2`}>
          <p className={label}>Entrega</p>
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
                <p>
                  Envio: {[address.freight.company, address.freight.name].filter(Boolean).join(" ")}
                </p>
              )}
            </>
          ) : (
            <p>A combinar</p>
          )}
          {order.tracking_code && <p>Rastreio: {order.tracking_code}</p>}
        </section>

        <section className={`${divider} py-2`}>
          <p className={`${label} mb-1`}>
            Itens ({units} {units === 1 ? "peça" : "peças"})
          </p>
          <ul className="flex flex-col gap-2">
            {order.order_items.map((item) => {
              const variant = formatVariantLabel(item.color, item.size);
              return (
                <li key={item.id} className="flex items-start gap-2 break-inside-avoid">
                  <span
                    className="mt-0.5 block size-4 shrink-0 border-2 border-black"
                    aria-label="Separado"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">
                      {item.qty}x {item.name}
                    </p>
                    {variant && <p>{variant}</p>}
                    <div className="flex justify-between gap-2">
                      <span>{formatCurrency(item.unit_price)} un.</span>
                      <span className="font-bold whitespace-nowrap">
                        {formatCurrency(item.unit_price * item.qty)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={`${divider} flex flex-col gap-0.5 py-2`}>
          {orderSummaryLines(summaryFromOrder(order)).map((line) => (
            <div
              key={line.kind}
              className={
                line.kind === "total"
                  ? "mt-1 flex justify-between gap-2 border-t-2 border-black pt-1 text-[17px] font-black"
                  : "flex justify-between gap-2"
              }
            >
              <span>{line.label}</span>
              <span className="whitespace-nowrap">{line.value}</span>
            </div>
          ))}
        </section>

        <section className={`${divider} pt-2 pb-[6mm]`}>
          <p className={`${label} mb-6`}>Observações</p>
          <div className="mb-6 border-b-2 border-black" />
          <div className="border-b-2 border-black" />
        </section>
      </main>
    </div>
  );
}
