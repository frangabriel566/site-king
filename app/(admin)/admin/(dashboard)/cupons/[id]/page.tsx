import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CouponForm } from "@/components/admin/coupon-form";
import { updateCouponAction } from "@/lib/actions/coupons";
import { getCouponByIdAdmin, getCouponOrdersAdmin } from "@/lib/data/coupons";
import { ORDER_STATUS_LABEL } from "@/lib/constants";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Editar cupom — Painel" };

export default async function EditCouponPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const coupon = await getCouponByIdAdmin(id);
  if (!coupon) notFound();
  const orders = await getCouponOrdersAdmin(coupon.code);
  const counted = orders.filter((order) => order.coupon_used_at).length;

  return (
    <div>
      <p className="text-label mb-2">Cupons</p>
      <h1 className="text-heading mb-8 text-3xl">Editar cupom</h1>
      <CouponForm coupon={coupon} action={updateCouponAction.bind(null, coupon.id)} />

      <section id="pedidos" className="mt-14 max-w-3xl scroll-mt-8">
        <p className="text-label mb-2">Pedidos com este cupom</p>
        <p className="mb-4 text-sm text-ink-muted">
          {orders.length === 0
            ? "Nenhum pedido usou este cupom ainda."
            : `${orders.length} ${orders.length === 1 ? "pedido" : "pedidos"}, ${counted} ${
                counted === 1 ? "venda confirmada" : "vendas confirmadas"
              } (são essas que contam no limite).`}
        </p>
        {orders.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow className="border-line hover:bg-transparent">
                <TableHead>Pedido</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Desconto</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Uso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} className="border-line">
                  <TableCell className="font-medium">
                    <Link href={`/admin/pedidos/${order.id}`} className="hover:text-accent-light">
                      #{order.code ?? order.order_number}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-ink-muted">
                    {formatDateTime(order.created_at)}
                  </TableCell>
                  <TableCell className="text-ink-muted">
                    {ORDER_STATUS_LABEL[order.status] ?? order.status}
                  </TableCell>
                  <TableCell className="text-right text-ink-muted">
                    {order.discount > 0 ? `-${formatCurrency(order.discount)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(order.total)}</TableCell>
                  <TableCell className="text-xs text-ink-muted">
                    {order.coupon_used_at ? "contado" : "não conta"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
