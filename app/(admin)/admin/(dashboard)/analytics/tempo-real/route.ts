import { NextResponse } from "next/server";
import { AdminAuthError, requireAdmin } from "@/lib/auth/guards";
import { getGaRealtime } from "@/lib/analytics/ga4-data";
import { localToday } from "@/lib/store-sales/period";

/**
 * Painel → Analytics → Tempo real. The page polls this every minute.
 * Admins only; the GA4 credentials stay here, the browser gets numbers
 * (aggregated — no visitor is identifiable from them).
 */

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    throw error;
  }
  const result = await getGaRealtime(localToday());
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
