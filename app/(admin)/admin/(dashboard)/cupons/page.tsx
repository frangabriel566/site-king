import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { getAllCouponsAdmin } from "@/lib/data/coupons";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ActiveBadge } from "@/components/admin/status-badge";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteCouponAction } from "@/lib/actions/coupons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Cupons — Painel" };

export default async function AdminCouponsPage() {
  const coupons = await getAllCouponsAdmin();

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-label mb-2">Painel</p>
          <h1 className="text-heading text-3xl">Cupons</h1>
        </div>
        <Button asChild size="lg">
          <Link href="/admin/cupons/novo">
            <Plus className="size-4" /> Novo cupom
          </Link>
        </Button>
      </div>

      {coupons.length === 0 ? (
        <p className="text-sm text-ink-muted">Nenhum cupom cadastrado.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-line hover:bg-transparent">
              <TableHead>Código</TableHead>
              <TableHead>Desconto</TableHead>
              <TableHead>Mínimo</TableHead>
              <TableHead>Expira</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons.map((coupon) => (
              <TableRow key={coupon.id} className="border-line">
                <TableCell className="font-medium">{coupon.code}</TableCell>
                <TableCell className="text-ink-muted">
                  {coupon.type === "percent"
                    ? `${coupon.value}%`
                    : formatCurrency(coupon.value)}
                </TableCell>
                <TableCell className="text-ink-muted">
                  {coupon.min_total > 0 ? formatCurrency(coupon.min_total) : "—"}
                </TableCell>
                <TableCell className="text-ink-muted">
                  {coupon.expires_at ? formatDate(coupon.expires_at) : "—"}
                </TableCell>
                <TableCell>
                  <ActiveBadge active={coupon.active} labels={["Ativo", "Inativo"]} />
                </TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon-sm" asChild>
                    <Link href={`/admin/cupons/${coupon.id}`} aria-label="Editar cupom">
                      <Pencil className="size-4" />
                    </Link>
                  </Button>
                  <DeleteButton
                    itemLabel="cupom"
                    action={deleteCouponAction.bind(null, coupon.id)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
