import type { Metadata } from "next";
import Image from "next/image";
import { AlertTriangle } from "lucide-react";
import { getInventoryRows } from "@/lib/data/inventory";
import { LOW_STOCK_THRESHOLD } from "@/lib/constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StockInput } from "./stock-input";

export const metadata: Metadata = { title: "Estoque — Painel" };

export default async function AdminInventoryPage() {
  const rows = await getInventoryRows();
  const lowStockCount = rows.filter((r) => r.stock <= LOW_STOCK_THRESHOLD).length;

  return (
    <div>
      <div className="mb-8">
        <p className="text-label mb-2">Painel</p>
        <h1 className="text-heading text-3xl">Estoque</h1>
        {lowStockCount > 0 && (
          <p className="mt-3 flex items-center gap-2 text-sm text-[var(--warning)]">
            <AlertTriangle className="size-4" />
            {lowStockCount} {lowStockCount === 1 ? "variação está" : "variações estão"} com estoque baixo (≤ {LOW_STOCK_THRESHOLD}).
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">Nenhuma variação cadastrada.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-line hover:bg-transparent">
              <TableHead>Produto</TableHead>
              <TableHead>Cor</TableHead>
              <TableHead>Tamanho</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Estoque</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="border-line">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="relative size-10 shrink-0 overflow-hidden bg-[#111111]">
                      {row.product.image && (
                        <Image
                          src={row.product.image}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <span className="truncate">{row.product.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-ink-muted">{row.color}</TableCell>
                <TableCell className="text-ink-muted">{row.size}</TableCell>
                <TableCell className="text-ink-muted">{row.sku ?? "—"}</TableCell>
                <TableCell>
                  <StockInput variantId={row.id} stock={row.stock} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
