import { NextResponse, type NextRequest } from "next/server";
import { AdminAuthError, requireAdmin } from "@/lib/auth/guards";
import { getSalesReport } from "@/lib/data/sales-report";
import { formatLocalDateTime } from "@/lib/store-sales/period";
import { REPORT_RANGES, REPORT_SOURCES, resolveReportPeriod } from "@/lib/reports/period";

/**
 * Painel → Relatórios → "Baixar planilha": every sale of the chosen source
 * and period as a CSV that Excel (Brazilian settings) opens as columns —
 * `;` between fields, decimal comma, and a UTF-8 BOM so "ç" and "ã" read
 * right. A summary on top, then one line per sale.
 */

export const dynamic = "force-dynamic";

const money = (value: number) => value.toFixed(2).replace(".", ",");

function cell(value: string | number): string {
  const text = String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function line(values: (string | number)[]): string {
  return values.map(cell).join(";");
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.redirect(new URL("/admin/login?next=/admin/relatorios", request.url));
    }
    throw error;
  }

  const params = request.nextUrl.searchParams;
  const period = resolveReportPeriod({
    origem: params.get("origem") ?? undefined,
    periodo: params.get("periodo") ?? undefined,
  });
  const report = await getSalesReport(period);

  const rows: string[] = [
    line(["Relatório de vendas — King Store"]),
    line(["Origem", REPORT_SOURCES[period.source]]),
    line(["Período", `${REPORT_RANGES[period.range].label} (${period.label})`]),
    line(["Faturamento", money(report.totals.revenue)]),
    line(["Vendas", report.totals.sales]),
    line(["Ticket médio", money(report.totals.averageTicket)]),
    line(["Peças vendidas", report.totals.pieces]),
    line(["Descontos", money(report.totals.discount)]),
  ];
  if (period.source === "todos") {
    rows.push(
      line(["Site — faturamento", money(report.site.revenue), "vendas", report.site.sales]),
      line(["Loja física — faturamento", money(report.loja.revenue), "vendas", report.loja.sales]),
    );
  }
  rows.push(
    "",
    line(["Data", "Origem", "Venda", "Cliente", "Pagamento", "Peças", "Desconto", "Frete", "Total"]),
    ...report.sales.map((sale) =>
      line([
        formatLocalDateTime(sale.createdAt),
        sale.origin === "site" ? "Site" : "Loja física",
        sale.number,
        sale.customer,
        sale.payment,
        sale.pieces,
        money(sale.discount),
        money(sale.shipping),
        money(sale.total),
      ]),
    ),
  );
  if (report.topProducts.length > 0) {
    rows.push(
      "",
      line(["Mais vendidos", "Peças", "Total"]),
      ...report.topProducts.map((p) => line([p.name, p.qty, money(p.revenue)])),
    );
  }

  const today = period.label.slice(-10).split("/").reverse().join("-");
  const filename = `relatorio-vendas-${period.source}-${period.range}-${today}.csv`;
  return new NextResponse(`﻿${rows.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
