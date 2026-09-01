import type { Metadata } from "next";
import { CouponForm } from "@/components/admin/coupon-form";
import { createCouponAction } from "@/lib/actions/coupons";

export const metadata: Metadata = { title: "Novo cupom — Painel" };

export default function NewCouponPage() {
  return (
    <div>
      <p className="text-label mb-2">Cupons</p>
      <h1 className="text-heading mb-8 text-3xl">Novo cupom</h1>
      <CouponForm action={createCouponAction} />
    </div>
  );
}
