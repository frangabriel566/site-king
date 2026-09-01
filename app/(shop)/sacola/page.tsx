import type { Metadata } from "next";
import { BagView } from "@/components/shop/bag-view";

export const metadata: Metadata = {
  title: "Sacola",
  description: "Revise os itens da sua sacola antes de finalizar a compra.",
};

export default function BagPage() {
  return <BagView />;
}
