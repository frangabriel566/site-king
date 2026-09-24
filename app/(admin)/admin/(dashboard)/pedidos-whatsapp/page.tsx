import type { Metadata } from "next";
import Link from "next/link";
import { getWhatsAppOrdersAdmin } from "@/lib/data/whatsapp-orders";
import {
  isWhatsAppOrderFilter,
  ORDER_STATUS_LABEL,
  WHATSAPP_ORDER_FILTERS,
  WHATSAPP_ORDER_TTL_HOURS,
} from "@/lib/constants";
import { formatCurrency, formatDateTime, formatVariantLabel } from "@/lib/format";
import { StatusBadge, ORDER_STATUS_TONE } from "@/components/admin/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WhatsAppFilterBar } from "./whatsapp-filter-bar";
import { WhatsAppOrderActions } from "./whatsapp-order-actions";

export const metadata: Metadata = { title: "Pedidos WhatsApp — Painel" };

/** A aba lê o estado agora (inclusive a varredura das 48h), então não
 *  pode servir HTML de cache. */
export const dynamic = "force-dynamic";

/** "Expira em 31h" é o que decide se vale a pena cobrar o cliente ou
 *  deixar morrer — mais útil que a data crua, que exige o atendente
 *  fazer a conta de cabeça. */
function remainingLabel(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expirando";
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `Expira em ${hours}h`;
  return `Expira em ${Math.max(1, Math.round(ms / 60_000))} min`;
}

export default async function AdminWhatsAppOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; busca?: string }>;
}) {
  const { filtro, busca } = await searchParams;
  const filter = isWhatsAppOrderFilter(filtro) ? filtro : "pendentes";
  const orders = await getWhatsAppOrdersAdmin({ filter, search: busca });
  const searching = Boolean(busca?.trim());

  return (
    <div>
      <div className="mb-8">
        <p className="text-label mb-2">Painel</p>
        <h1 className="text-heading text-3xl">Pedidos WhatsApp</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Pedidos abertos pelo botão &ldquo;Comprar pelo WhatsApp&rdquo; da loja.
          Eles <strong>não reservam estoque</strong>: a baixa acontece quando
          você confirma a venda, e pendentes expiram sozinhos depois de{" "}
          {WHATSAPP_ORDER_TTL_HOURS} horas.
        </p>
      </div>

      <WhatsAppFilterBar filter={filter} search={busca} />

      {searching && (
        <p className="mt-4 text-xs text-ink-muted">
          Buscando por código em todos os status, ignorando o filtro
          &ldquo;{WHATSAPP_ORDER_FILTERS[filter].label}&rdquo;.
        </p>
      )}

      {orders.length === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">
          {searching
            ? "Nenhum pedido com esse código."
            : "Nenhum pedido de WhatsApp neste filtro."}
        </p>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow className="border-line hover:bg-transparent">
              <TableHead>Código</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const snapshot = order.customer_snapshot as {
                name?: string;
                phone?: string;
              } | null;
              const isPending = order.status === "aguardando_whatsapp";

              return (
                <TableRow key={order.id} className="border-line align-top">
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/pedidos/${order.id}`}
                      className="hover:text-accent-light"
                    >
                      #{order.code}
                    </Link>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      Pedido #{order.order_number}
                    </span>
                  </TableCell>
                  <TableCell className="text-ink-muted">
                    {formatDateTime(order.created_at)}
                    {isPending && order.expires_at && (
                      <span className="mt-0.5 block text-xs text-[var(--warning)]">
                        {remainingLabel(order.expires_at)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-ink-muted">
                    {/* Visitante é o caso normal aqui: a compra direta não
                        exige login, e quem é o cliente se resolve na
                        própria conversa. */}
                    {snapshot?.name ?? "Visitante"}
                    {snapshot?.phone && (
                      <span className="mt-0.5 block text-xs">{snapshot.phone}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-ink-muted">
                    <ul className="flex flex-col gap-1 text-xs">
                      {order.order_items.map((item) => {
                        const variant = formatVariantLabel(item.color, item.size);
                        return (
                          <li key={item.id}>
                            {item.qty}x {item.name}
                            {variant ? ` — ${variant}` : ""}
                          </li>
                        );
                      })}
                    </ul>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={ORDER_STATUS_TONE[order.status]}>
                      {ORDER_STATUS_LABEL[order.status] ?? order.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(order.total)}
                  </TableCell>
                  <TableCell className="text-right">
                    {isPending ? (
                      <WhatsAppOrderActions
                        orderId={order.id}
                        code={order.code ?? ""}
                        total={formatCurrency(order.total)}
                      />
                    ) : (
                      <Link
                        href={`/admin/pedidos/${order.id}`}
                        className="text-xs text-ink-muted hover:text-accent-light"
                      >
                        Ver pedido
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
