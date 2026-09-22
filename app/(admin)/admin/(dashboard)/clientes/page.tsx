import type { Metadata } from "next";
import Link from "next/link";
import { getAllCustomersAdmin } from "@/lib/data/customers";
import { formatDate } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Clientes — Painel" };

export default async function AdminCustomersPage() {
  const customers = await getAllCustomersAdmin();

  return (
    <div>
      <div className="mb-8">
        <p className="text-label mb-2">Painel</p>
        <h1 className="text-heading text-3xl">Clientes</h1>
      </div>

      {customers.length === 0 ? (
        <p className="text-sm text-ink-muted">Nenhum cliente cadastrado.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-line hover:bg-transparent">
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Desde</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id} className="border-line">
                <TableCell>
                  <Link href={`/admin/clientes/${customer.id}`} className="hover:text-accent-light">
                    {customer.name}
                  </Link>
                </TableCell>
                <TableCell className="text-ink-muted">{customer.email ?? "—"}</TableCell>
                <TableCell className="text-ink-muted">{customer.phone}</TableCell>
                <TableCell className="text-ink-muted">
                  {formatDate(customer.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
