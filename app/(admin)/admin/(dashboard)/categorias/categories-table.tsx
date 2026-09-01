"use client";

import Link from "next/link";
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
import { deleteCategoryAction } from "@/lib/actions/categories";
import type { Category } from "@/lib/data/categories";

export function CategoriesTable({ categories }: { categories: Category[] }) {
  const router = useRouter();

  if (categories.length === 0) {
    return (
      <p className="text-sm text-ink-muted">Nenhuma categoria cadastrada.</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-line hover:bg-transparent">
          <TableHead>Nome</TableHead>
          <TableHead>Slug</TableHead>
          <TableHead>Posição</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((category) => (
          <TableRow key={category.id} className="border-line">
            <TableCell className="font-medium">{category.name}</TableCell>
            <TableCell className="text-ink-muted">{category.slug}</TableCell>
            <TableCell className="text-ink-muted">{category.position}</TableCell>
            <TableCell>
              <Badge
                variant={category.active ? "default" : "outline"}
                className="rounded-none"
              >
                {category.active ? "Ativa" : "Inativa"}
              </Badge>
            </TableCell>
            <TableCell className="flex justify-end gap-1">
              <Button variant="ghost" size="icon-sm" asChild>
                <Link href={`/admin/categorias/${category.id}`} aria-label={`Editar ${category.name}`}>
                  <Pencil className="size-4" />
                </Link>
              </Button>
              <DeleteButton
                itemLabel="categoria"
                action={deleteCategoryAction.bind(null, category.id)}
                onDeleted={() => router.refresh()}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
