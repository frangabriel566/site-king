import type { Metadata } from "next";
import { BagView } from "@/components/shop/bag-view";
import { getSiteSettings } from "@/lib/data/settings";

export const metadata: Metadata = {
  title: "Sacola",
  description: "Revise os itens da sua sacola antes de finalizar a compra.",
};

export default async function BagPage() {
  const settings = await getSiteSettings();
  return <BagView whatsappEnabled={Boolean(settings.whatsapp)} />;
}
