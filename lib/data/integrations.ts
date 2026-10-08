import "server-only";
import { and, desc, eq, isNull, lte, or, type AnyColumn } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/guards";
import { getSiteSettings } from "@/lib/data/settings";
import type { IntegrationEnvironment, IntegrationProvider } from "@/lib/db/schema";
import { isEncryptionKeyConfigured } from "@/lib/integrations/crypto";
import { integrationState, type IntegrationSource } from "@/lib/integrations";
import { getSalesMode, type SalesMode } from "@/lib/sales-mode";
import { isValidCep } from "@/lib/shipping/package";

/**
 * What the Integrações screen shows — and, on purpose, nothing more: the
 * saved tokens never leave the server, only their last 4 characters.
 */
export type IntegrationView = {
  provider: IntegrationProvider;
  /** Where the credentials in use come from. */
  source: IntegrationSource;
  /** Credentials saved in the panel. */
  saved: boolean;
  environment: IntegrationEnvironment;
  /** Last 4 characters of each saved token, by field. */
  hints: Record<string, string>;
  /** Melhor Envio's contact e-mail. */
  email: string | null;
  active: boolean;
  testOk: boolean;
  testedAt: string | null;
  testMessage: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type IntegrationLogEntry = {
  id: string;
  provider: IntegrationProvider;
  action: string;
  actorEmail: string | null;
  createdAt: string;
};

export type ProductMissingPackage = { id: string; name: string };

const { integrations, integration_log, products } = schema;

/** Active products the carriers can't quote: no weight or a measure. */
export async function getActiveProductsMissingPackage(): Promise<ProductMissingPackage[]> {
  const missing = (column: AnyColumn) => or(isNull(column), lte(column, 0));
  return getDb()
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(
      and(
        eq(products.status, "active"),
        or(
          missing(products.weight_grams),
          missing(products.length_cm),
          missing(products.width_cm),
          missing(products.height_cm),
        ),
      ),
    )
    .orderBy(products.name)
    .limit(200);
}

export async function getIntegrationsAdmin(): Promise<{
  keyConfigured: boolean;
  mercadopago: IntegrationView;
  melhorenvio: IntegrationView;
  log: IntegrationLogEntry[];
  missingPackage: ProductMissingPackage[];
  originCep: string | null;
  originCepValid: boolean;
  sales: SalesMode;
}> {
  await requireAdminPage();
  const db = getDb();
  const [rows, log, missingPackage, settings] = await Promise.all([
    db.select().from(integrations),
    db.select().from(integration_log).orderBy(desc(integration_log.created_at)).limit(20),
    getActiveProductsMissingPackage(),
    getSiteSettings(),
  ]);

  async function view(provider: IntegrationProvider): Promise<IntegrationView> {
    const row = rows.find((r) => r.provider === provider);
    const state = await integrationState(provider);
    return {
      provider,
      source: state.source,
      saved: Boolean(row?.secrets),
      environment: row?.environment ?? "test",
      hints: row?.hints ?? {},
      email: row?.options?.email ?? null,
      active: row?.secrets ? row.active : state.active,
      testOk: row?.test_ok ?? false,
      testedAt: row?.tested_at ?? null,
      testMessage: row?.test_message ?? null,
      updatedAt: row?.updated_at ?? null,
      updatedBy: row?.updated_by ?? null,
    };
  }

  return {
    keyConfigured: isEncryptionKeyConfigured(),
    mercadopago: await view("mercadopago"),
    melhorenvio: await view("melhorenvio"),
    log: log.map((entry) => ({
      id: entry.id,
      provider: entry.provider,
      action: entry.action,
      actorEmail: entry.actor_email,
      createdAt: entry.created_at,
    })),
    missingPackage,
    originCep: settings.origin_cep,
    originCepValid: isValidCep(settings.origin_cep ?? ""),
    sales: await getSalesMode(settings),
  };
}
