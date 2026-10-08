import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { getAllCouponsAdmin } from "@/lib/data/coupons";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteCouponAction } from "@/lib/actions/coupons";
import { CouponActiveToggle } from "./coupon-active-toggle";
import { CopyCouponLink } from "./copy-coupon-link";
import { getRequestOrigin } from "@/lib/site-url";
import type { Coupon } from "@/lib/data/coupons";
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
  const [coupons, origin] = await Promise.all([getAllCouponsAdmin(), getRequestOrigin()]);
  // The store's public address (sitekingstore.com.br in production); the
  // panel's own address only as a fallback.
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || origin).replace(/\/+$/, "");

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
              <TableHead>Validade</TableHead>
              <TableHead>Usos</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons.map((coupon) => (
              <TableRow key={coupon.id} className="border-line">
                <TableCell className="font-medium">{coupon.code}</TableCell>
                <TableCell className="text-ink-muted">
                  {describeDiscount(coupon)}
                </TableCell>
                <TableCell className="text-ink-muted">
                  {coupon.min_total > 0 ? formatCurrency(coupon.min_total) : "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-ink-muted">
                  {describeValidity(coupon)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-ink-muted">
                  {/* Confirmed sales only; the orders are on the coupon's page. */}
                  <Link
                    href={`/admin/cupons/${coupon.id}#pedidos`}
                    className="hover:text-fg hover:underline"
                    title="Ver os pedidos com este cupom"
                  >
                    <span className="font-medium text-fg">{coupon.used_count}</span>
                    {coupon.max_uses !== null ? ` / ${coupon.max_uses}` : ""}
                  </Link>
                  {coupon.max_uses !== null && coupon.used_count >= coupon.max_uses && (
                    <span className="ml-2 text-xs text-warning">esgotado</span>
                  )}
                  {coupon.one_per_phone && (
                    <span className="block text-xs">1 por telefone</span>
                  )}
                </TableCell>
                <TableCell>
                  <CouponActiveToggle id={coupon.id} code={coupon.code} active={coupon.active} />
                </TableCell>
                <TableCell className="flex justify-end gap-1">
                  <CopyCouponLink
                    code={coupon.code}
                    url={`${siteUrl}/?cupom=${encodeURIComponent(coupon.code)}`}
                  />
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

function describeDiscount(coupon: Coupon): string {
  const amount =
    coupon.value > 0
      ? coupon.type === "percent"
        ? `${String(coupon.value).replace(".", ",")}%`
        : formatCurrency(coupon.value)
      : null;
  return [amount, coupon.free_shipping ? "frete grátis" : null].filter(Boolean).join(" + ");
}

/** Dates are whole days (lib/coupons/rules.ts); shown at noon UTC so no
 * time zone pushes them to the day before. */
function describeValidity(coupon: Coupon): string {
  const day = (value: string) => formatDate(`${value.slice(0, 10)}T12:00:00Z`);
  if (coupon.starts_at && coupon.expires_at) return `${day(coupon.starts_at)} a ${day(coupon.expires_at)}`;
  if (coupon.starts_at) return `a partir de ${day(coupon.starts_at)}`;
  if (coupon.expires_at) return `até ${day(coupon.expires_at)}`;
  return "—";
}
