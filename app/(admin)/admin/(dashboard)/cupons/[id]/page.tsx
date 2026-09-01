import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CouponForm } from "@/components/admin/coupon-form";
import { updateCouponAction } from "@/lib/actions/coupons";
import { getCouponByIdAdmin } from "@/lib/data/coupons";

export const metadata: Metadata = { title: "Editar cupom — Painel" };

export default async function EditCouponPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const coupon = await getCouponByIdAdmin(id);
  if (!coupon) notFound();

  return (
    <div>
      <p className="text-label mb-2">Cupons</p>
      <h1 className="text-heading mb-8 text-3xl">Editar cupom</h1>
      <CouponForm coupon={coupon} action={updateCouponAction.bind(null, coupon.id)} />
    </div>
  );
}
