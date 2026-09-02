import type { Metadata } from "next";
import { CheckoutWizard } from "@/components/shop/checkout-wizard";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  const paymentProvider = process.env.PAYMENT_PROVIDER ?? "mercadopago";

  return (
    <div className="px-8 py-12 md:px-12">
      <h1 className="mb-10 text-2xl font-bold text-fg md:text-3xl">Checkout</h1>
      <CheckoutWizard paymentProvider={paymentProvider} />
    </div>
  );
}
