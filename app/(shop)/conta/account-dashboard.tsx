"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { customerSignOutAction } from "@/lib/actions/customer-auth";
import type { Order } from "@/lib/data/orders";
import type { Address } from "@/lib/data/addresses";
import type { Tables } from "@/lib/database.types";
import { AddressManager } from "./address-manager";

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando pagamento",
  paid: "Pago",
  processing: "Em preparação",
  shipped: "Enviado",
  delivered: "Entregue",
  canceled: "Cancelado",
};

export function AccountDashboard({
  email,
  customer,
  orders,
  addresses,
}: {
  email: string;
  customer: Tables<"customers"> | null;
  orders: Order[];
  addresses: Address[];
}) {
  return (
    <Tabs defaultValue="pedidos">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <TabsList className="rounded-none">
          <TabsTrigger value="pedidos" className="rounded-none">Pedidos</TabsTrigger>
          <TabsTrigger value="enderecos" className="rounded-none">Endereços</TabsTrigger>
          <TabsTrigger value="dados" className="rounded-none">Dados</TabsTrigger>
        </TabsList>
        <form action={customerSignOutAction}>
          <Button type="submit" variant="outline" size="sm">
            Sair
          </Button>
        </form>
      </div>

      <TabsContent value="pedidos">
        {orders.length === 0 ? (
          <p className="text-sm text-ink-muted">Você ainda não fez nenhum pedido.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {orders.map((order) => (
              <li key={order.id} className="flex items-center justify-between py-5">
                <div>
                  <p className="text-sm">Pedido #{order.order_number}</p>
                  <p className="text-xs text-ink-muted">
                    {formatDate(order.created_at)} · {STATUS_LABEL[order.status] ?? order.status}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm">{formatCurrency(order.total)}</span>
                  <Link href={`/pedido/${order.id}`} className="link-arrow">
                    Ver →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="enderecos">
        <AddressManager addresses={addresses} />
      </TabsContent>

      <TabsContent value="dados">
        <div className="max-w-sm">
          <dl className="flex flex-col gap-4">
            <div>
              <dt className="text-label">Nome</dt>
              <dd className="text-sm">{customer?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-label">E-mail</dt>
              <dd className="text-sm">{email}</dd>
            </div>
            <div>
              <dt className="text-label">Telefone</dt>
              <dd className="text-sm">{customer?.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-label">Data de nascimento</dt>
              <dd className="text-sm">
                {customer?.birthdate ? formatDate(customer.birthdate) : "—"}
              </dd>
            </div>
          </dl>
        </div>
      </TabsContent>
    </Tabs>
  );
}
