import type { Metadata } from "next";
import { Cake } from "lucide-react";
import { getBirthdayMessage, getStoreCustomers, getUpcomingBirthdays } from "@/lib/data/store-sales";
import { getSiteSettings } from "@/lib/data/settings";
import { formatCurrency, formatPhone } from "@/lib/format";
import { formatLocalDateTime } from "@/lib/store-sales/period";
import {
  BIRTHDAY_WINDOW_DAYS,
  buildBirthdayMessage,
  customerWhatsAppLink,
  formatDayMonth,
} from "@/lib/store-sales/birthday";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BirthdaySendButton } from "./birthday-send-button";
import { BirthdayMessageForm } from "./birthday-message-form";
import { CustomerRowActions, CustomersToolbar } from "./customer-actions";

export const metadata: Metadata = { title: "Clientes da loja — Vendas na loja" };

export const dynamic = "force-dynamic";

function whenLabel(daysUntil: number): string {
  if (daysUntil === 0) return "Hoje";
  if (daysUntil === 1) return "Amanhã";
  return `Em ${daysUntil} dias`;
}

export default async function StoreCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>;
}) {
  const { busca } = await searchParams;
  const [customers, birthdays, savedMessage, settings] = await Promise.all([
    getStoreCustomers(busca),
    getUpcomingBirthdays(),
    getBirthdayMessage(),
    getSiteSettings(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-line bg-card p-4 md:p-6">
          <h2 className="text-label mb-1 flex items-center gap-2">
            <Cake className="size-4 text-accent-light" aria-hidden="true" />
            Aniversariantes
          </h2>
          <p className="mb-5 text-xs text-ink-muted">
            Hoje e nos próximos {BIRTHDAY_WINDOW_DAYS} dias. &ldquo;Mandar mensagem&rdquo; abre o WhatsApp
            com o texto pronto, é só enviar.
          </p>
          {birthdays.length === 0 ? (
            <p className="text-sm text-ink-muted">
              Nenhum aniversário nos próximos {BIRTHDAY_WINDOW_DAYS} dias. Cadastre a data de nascimento
              dos clientes para que apareçam aqui.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {birthdays.map((birthday) => (
                <li key={birthday.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {birthday.name}
                      <StatusBadge tone={birthday.daysUntil === 0 ? "success" : "neutral"}>
                        {whenLabel(birthday.daysUntil)}
                      </StatusBadge>
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {formatDayMonth(birthday.date)} · faz {birthday.turning} anos
                      {birthday.phone ? ` · ${formatPhone(birthday.phone)}` : ""}
                    </p>
                  </div>
                  {birthday.phone ? (
                    <BirthdaySendButton
                      customerId={birthday.id}
                      sent={birthday.sentThisYear}
                      href={customerWhatsAppLink(
                        birthday.phone,
                        buildBirthdayMessage(savedMessage, { name: birthday.name, storeName: settings.store_name }),
                      )}
                    />
                  ) : (
                    <p className="shrink-0 text-xs text-ink-muted">Sem telefone</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-line bg-card p-4 md:p-6">
          <h2 className="text-label mb-4">Mensagem de aniversário</h2>
          <BirthdayMessageForm saved={savedMessage} storeName={settings.store_name} />
        </section>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-label">Clientes da loja</h2>
        <CustomersToolbar search={busca} />
        {customers.length === 0 ? (
          <p className="text-sm text-ink-muted">
            {busca?.trim() ? "Nenhum cliente com esse nome ou telefone." : "Nenhum cliente cadastrado ainda."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-line hover:bg-transparent">
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Aniversário</TableHead>
                <TableHead className="text-right">Compras</TableHead>
                <TableHead className="text-right">Total gasto</TableHead>
                <TableHead>Última compra</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id} className="border-line">
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="whitespace-nowrap text-ink-muted">
                    {customer.phone ? formatPhone(customer.phone) : "—"}
                  </TableCell>
                  <TableCell className="text-ink-muted">
                    {customer.birthdate ? formatDayMonth(customer.birthdate) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{customer.purchases}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(customer.spent)}</TableCell>
                  <TableCell className="whitespace-nowrap text-ink-muted">
                    {customer.last_purchase ? formatLocalDateTime(customer.last_purchase).slice(0, 10) : "—"}
                  </TableCell>
                  <TableCell>
                    <CustomerRowActions
                      customer={{
                        id: customer.id,
                        name: customer.name,
                        phone: customer.phone,
                        birthdate: customer.birthdate,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
