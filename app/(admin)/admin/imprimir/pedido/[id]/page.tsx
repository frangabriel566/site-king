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
import { TICKET_FONT, type TicketBlock } from "@/lib/orders/ticket";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Imprimir pedido — Painel" };

/**
 * A notinha do pedido, para a impressora térmica de bobina 80 mm: fica fora
 * do layout do painel, sem menu, em preto puro e letra grande — a térmica
 * não imprime cinza. O botão imprime um PDF gerado destes mesmos blocos. Sem foto (na térmica vira um borrão preto). Cada peça
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
  const [order, settings] = await Promise.all([
    getOrderByIdAdmin(id),
    getSiteSettings(),
  ]);
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

  const { small, body, total, title } = TICKET_FONT;
  const orderCode = `${order.code ?? order.order_number}`;
  const line = (text: string): TicketBlock => ({ kind: "text", text });
  const center = (text: string, size: number = body): TicketBlock => ({
    kind: "text",
    text,
    size,
    align: "center",
  });
  const heading = (text: string): TicketBlock => ({
    kind: "text",
    text,
    size: small,
  });

  const blocks: TicketBlock[] = [
    center(settings.store_name.toUpperCase(), title),
    ...(settings.whatsapp
      ? [center(`WhatsApp ${formatPhone(settings.whatsapp)}`)]
      : []),
    { kind: "divider" },
    center(`Pedido #${orderCode}`, title),
    center(formatDateTime(order.created_at)),
    center(
      `${ORDER_STATUS_LABEL[order.status] ?? order.status}${
        order.payment_method ? ` · ${order.payment_method}` : ""
      }`,
    ),
    { kind: "divider" },
    heading("CLIENTE"),
    line(customer?.name ?? "—"),
    ...(phone ? [line(formatPhone(phone))] : []),
    ...(customer?.email ? [line(customer.email)] : []),
    ...(customer?.document
      ? [line(`CPF ${formatCpf(customer.document)}`)]
      : []),
    { kind: "divider" },
    heading("ENTREGA"),
    ...(address?.street
      ? [
          line(
            `${address.street}, ${address.number}${
              address.complement ? ` — ${address.complement}` : ""
            }`,
          ),
          line(`${address.district} · ${address.city}/${address.state}`),
          ...(address.cep ? [line(`CEP ${formatCep(address.cep)}`)] : []),
          ...(address.freight
            ? [
                line(
                  `Envio: ${[address.freight.company, address.freight.name]
                    .filter(Boolean)
                    .join(" ")}`,
                ),
              ]
            : []),
        ]
      : [line("A combinar")]),
    ...(order.tracking_code ? [line(`Rastreio: ${order.tracking_code}`)] : []),
    { kind: "divider" },
    heading(`ITENS (${units} ${units === 1 ? "PEÇA" : "PEÇAS"})`),
    { kind: "space", height: 3 },
    ...order.order_items.flatMap((item): TicketBlock[] => {
      const variant = formatVariantLabel(item.color, item.size);
      return [
        { kind: "text", text: `${item.qty}x ${item.name}`, checkbox: true },
        ...(variant
          ? [{ kind: "text", text: variant, indent: true } as const]
          : []),
        {
          kind: "row",
          left: `${formatCurrency(item.unit_price)} un.`,
          right: formatCurrency(item.unit_price * item.qty),
          indent: true,
        },
        { kind: "space", height: 6 },
      ];
    }),
    { kind: "divider" },
    ...orderSummaryLines(summaryFromOrder(order)).flatMap(
      (summary): TicketBlock[] =>
        summary.kind === "total"
          ? [
              { kind: "rule" },
              {
                kind: "row",
                left: summary.label,
                right: summary.value,
                size: total,
              },
            ]
          : [{ kind: "row", left: summary.label, right: summary.value }],
    ),
    { kind: "divider" },
    heading("OBSERVAÇÕES"),
    { kind: "writeLine" },
    { kind: "writeLine" },
  ];

  return (
    <div className="min-h-dvh bg-white text-black">
      <div className="flex justify-center py-4">
        <PrintButton blocks={blocks} title={`Pedido ${orderCode}`} />
      </div>

      <main
        id="notinha"
        className="mx-auto box-border w-[80mm] px-[4mm] py-[3mm] leading-snug font-bold [overflow-wrap:anywhere]"
      >
        {blocks.map((block, index) => (
          <TicketPreviewBlock key={index} block={block} />
        ))}
      </main>
    </div>
  );
}

function TicketPreviewBlock({ block }: { block: TicketBlock }) {
  if (block.kind === "divider")
    return <div className="my-2 border-t-2 border-dashed border-black" />;
  if (block.kind === "rule")
    return <div className="my-1 border-t-2 border-black" />;
  if (block.kind === "space")
    return <div style={{ height: `${block.height}pt` }} />;
  if (block.kind === "writeLine")
    return <div className="h-8 border-b-2 border-black" />;
  const fontSize = `${block.size ?? TICKET_FONT.body}pt`;
  const indent = block.indent ? "ml-6" : "";
  if (block.kind === "row") {
    return (
      <div
        className={`flex justify-between gap-2 ${indent}`}
        style={{ fontSize }}
      >
        <span>{block.left}</span>
        <span className="whitespace-nowrap">{block.right}</span>
      </div>
    );
  }
  if (block.checkbox) {
    return (
      <div className="flex items-start gap-2" style={{ fontSize }}>
        <span
          className="mt-0.5 block size-4 shrink-0 border-2 border-black"
          aria-label="Separado"
        />
        <span>{block.text}</span>
      </div>
    );
  }
  return (
    <p
      className={`${indent} ${block.align === "center" ? "text-center" : ""}`}
      style={{ fontSize }}
    >
      {block.text}
    </p>
  );
}
