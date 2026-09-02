"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteBrandAction } from "@/lib/actions/brands";
import type { AdminBrandListItem } from "@/lib/data/brands";

export function BrandsTable({ brands }: { brands: AdminBrandListItem[] }) {
  const router = useRouter();

  if (brands.length === 0) {
    return <p className="text-sm text-ink-muted">Nenhuma marca cadastrada.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-line hover:bg-transparent">
          <TableHead>Logo</TableHead>
          <TableHead>Nome</TableHead>
          <TableHead>Slug</TableHead>
          <TableHead>Produtos</TableHead>
          <TableHead>Posição</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {brands.map((brand) => (
          <TableRow key={brand.id} className="border-line">
            <TableCell>
              {brand.logo_url ? (
                <div className="relative size-9 overflow-hidden bg-[#111111]">
                  <Image src={brand.logo_url} alt="" fill sizes="36px" className="object-contain" />
                </div>
              ) : (
                <div className="size-9 bg-[#111111]" />
              )}
            </TableCell>
            <TableCell className="font-medium">{brand.name}</TableCell>
            <TableCell className="text-ink-muted">{brand.slug}</TableCell>
            <TableCell className="text-ink-muted">{brand.productCount}</TableCell>
            <TableCell className="text-ink-muted">{brand.position}</TableCell>
            <TableCell>
              <Badge variant={brand.active ? "default" : "outline"} className="rounded-none">
                {brand.active ? "Ativa" : "Inativa"}
              </Badge>
            </TableCell>
            <TableCell className="flex justify-end gap-1">
              <Button variant="ghost" size="icon-sm" asChild>
                <Link href={`/admin/marcas/${brand.id}`} aria-label={`Editar ${brand.name}`}>
                  <Pencil className="size-4" />
                </Link>
              </Button>
              <DeleteButton
                itemLabel="marca"
                description={
                  brand.productCount > 0
                    ? `${brand.productCount} produto${brand.productCount === 1 ? "" : "s"} usa${brand.productCount === 1 ? "" : "m"} esta marca. Eles continuarão existindo, apenas ficarão sem marca.`
                    : "Esta ação não pode ser desfeita."
                }
                action={deleteBrandAction.bind(null, brand.id)}
                onDeleted={() => router.refresh()}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
