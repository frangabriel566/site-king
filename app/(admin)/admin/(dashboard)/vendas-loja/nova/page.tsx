import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/guards";
import { StoreSaleForm } from "./store-sale-form";

export const metadata: Metadata = { title: "Nova baixa — Vendas na loja" };

export default async function NewStoreSalePage() {
  await requireAdminPage("/admin/vendas-loja/nova");
  return <StoreSaleForm />;
}
