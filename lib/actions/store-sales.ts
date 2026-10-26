"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb, schema } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/errors";
import { formatCurrency } from "@/lib/format";
import {
  searchStoreCustomers,
  searchStoreProducts,
  type StoreCustomerOption,
  type StoreProductResult,
} from "@/lib/data/store-sales";
import { StoreSaleError, cancelStoreSale, createStoreSale, type StoreSaleErrorCode } from "@/lib/store-sales/sales";
import { nextBirthday } from "@/lib/store-sales/birthday";
import { localToday } from "@/lib/store-sales/period";
import {
  birthdayMessageSchema,
  storeCustomerIdSchema,
  storeCustomerSchema,
  storeSaleIdSchema,
  storeSaleSchema,
} from "@/lib/validations/store-sale";

const { store_customers, store_settings } = schema;

export type StoreSaleActionResult = { ok: true; message: string } | { ok: false; message: string };

function revalidateStoreSales() {
  revalidatePath("/admin/vendas-loja", "layout");
  revalidatePath("/admin/estoque");
  revalidatePath("/admin/produtos");
  revalidatePath("/admin");
}

const SALE_ERRORS: Record<StoreSaleErrorCode, string> = {
  VARIANT_NOT_FOUND: "Uma das peças não está mais no catálogo. Busque de novo e tente outra vez.",
  OUT_OF_STOCK: "Sem estoque suficiente de uma das peças. Nada foi baixado.",
  DISCOUNT_TOO_HIGH: "O desconto não pode ser maior que o valor das peças.",
  CUSTOMER_NOT_FOUND: "O cliente escolhido não está mais cadastrado.",
  NOT_FOUND: "Venda não encontrada.",
  ALREADY_CANCELED: "Esta baixa já foi desfeita.",
};

function translateSaleError(error: unknown, fallback: string): string {
  if (!(error instanceof StoreSaleError)) return fallback;
  // The piece that ran out is what the store needs to know.
  if (error.code === "OUT_OF_STOCK" && error.detail) {
    return `Sem estoque suficiente de ${error.detail}. Nada foi baixado.`;
  }
  return SALE_ERRORS[error.code];
}

/** "Dar baixa": records the sale and takes the pieces out of stock. */
export async function createStoreSaleAction(input: unknown): Promise<StoreSaleActionResult> {
  const parsed = storeSaleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Venda inválida." };
  }

  const admin = await requireAdmin();
  try {
    const sale = await createStoreSale(parsed.data, admin.email);
    revalidateStoreSales();
    return {
      ok: true,
      message: `Venda #${sale.saleNumber} registrada: ${sale.pieces} ${
        sale.pieces === 1 ? "peça baixada" : "peças baixadas"
      }, ${formatCurrency(sale.total)}.`,
    };
  } catch (error) {
    if (!(error instanceof StoreSaleError)) console.error("[createStoreSaleAction]", error);
    return { ok: false, message: translateSaleError(error, "Não foi possível registrar a venda.") };
  }
}

/** "Desfazer baixa": the pieces go back to stock. */
export async function cancelStoreSaleAction(input: unknown): Promise<StoreSaleActionResult> {
  const parsed = storeSaleIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Venda inválida." };

  await requireAdmin();
  try {
    const result = await cancelStoreSale(parsed.data.sale_id);
    revalidateStoreSales();
    const missing =
      result.notRestored > 0
        ? ` ${result.notRestored} ${result.notRestored === 1 ? "peça não voltou" : "peças não voltaram"} porque a variação saiu do catálogo.`
        : "";
    return {
      ok: true,
      message: `Baixa da venda #${result.saleNumber} desfeita. ${result.restored} ${
        result.restored === 1 ? "peça voltou" : "peças voltaram"
      } ao estoque.${missing}`,
    };
  } catch (error) {
    if (!(error instanceof StoreSaleError)) console.error("[cancelStoreSaleAction]", error);
    revalidateStoreSales();
    return { ok: false, message: translateSaleError(error, "Não foi possível desfazer a baixa.") };
  }
}

export async function searchStoreProductsAction(term: unknown): Promise<StoreProductResult[]> {
  if (typeof term !== "string") return [];
  await requireAdmin();
  return searchStoreProducts(term.slice(0, 80));
}

export async function searchStoreCustomersAction(term: unknown): Promise<StoreCustomerOption[]> {
  if (typeof term !== "string") return [];
  await requireAdmin();
  return searchStoreCustomers(term.slice(0, 80));
}

export type StoreCustomerActionResult =
  | { ok: true; customer: StoreCustomerOption }
  | { ok: false; message: string };

function customerSaveError(error: unknown, context: string): StoreCustomerActionResult {
  if (isUniqueViolation(error, "store_customers.phone")) {
    return { ok: false, message: "Já existe um cliente cadastrado com esse telefone." };
  }
  console.error(context, error);
  return { ok: false, message: "Não foi possível salvar o cliente." };
}

export async function createStoreCustomerAction(input: unknown): Promise<StoreCustomerActionResult> {
  const parsed = storeCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await requireAdmin();
  try {
    const [customer] = await getDb()
      .insert(store_customers)
      .values(parsed.data)
      .returning({ id: store_customers.id, name: store_customers.name, phone: store_customers.phone });
    revalidatePath("/admin/vendas-loja/clientes");
    return { ok: true, customer };
  } catch (error) {
    return customerSaveError(error, "[createStoreCustomerAction]");
  }
}

export async function updateStoreCustomerAction(input: unknown): Promise<StoreCustomerActionResult> {
  const id = storeCustomerIdSchema.safeParse(input);
  const parsed = storeCustomerSchema.safeParse(input);
  if (!id.success) return { ok: false, message: "Cliente inválido." };
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await requireAdmin();
  try {
    const db = getDb();
    const [before] = await db
      .select({ birthdate: store_customers.birthdate })
      .from(store_customers)
      .where(eq(store_customers.id, id.data.customer_id));
    if (!before) return { ok: false, message: "Cliente não encontrado." };

    const [customer] = await db
      .update(store_customers)
      .set({
        ...parsed.data,
        // A corrected birthday is a new birthday: it hasn't been congratulated.
        ...(before.birthdate !== parsed.data.birthdate ? { birthday_sent_year: null } : {}),
      })
      .where(eq(store_customers.id, id.data.customer_id))
      .returning({ id: store_customers.id, name: store_customers.name, phone: store_customers.phone });
    revalidatePath("/admin/vendas-loja", "layout");
    return { ok: true, customer };
  } catch (error) {
    return customerSaveError(error, "[updateStoreCustomerAction]");
  }
}

/** The customer leaves the book; their sales keep the name they had. */
export async function deleteStoreCustomerAction(input: unknown): Promise<{ ok: boolean; message?: string }> {
  const parsed = storeCustomerIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Cliente inválido." };

  await requireAdmin();
  try {
    await getDb().delete(store_customers).where(eq(store_customers.id, parsed.data.customer_id));
  } catch (error) {
    console.error("[deleteStoreCustomerAction]", error);
    return { ok: false, message: "Não foi possível excluir o cliente." };
  }
  revalidatePath("/admin/vendas-loja", "layout");
  return { ok: true };
}

/** "Mandar mensagem" was opened: the list marks this birthday as done. */
export async function markBirthdaySentAction(input: unknown): Promise<{ ok: boolean }> {
  const parsed = storeCustomerIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  await requireAdmin();
  const db = getDb();
  const [customer] = await db
    .select({ birthdate: store_customers.birthdate })
    .from(store_customers)
    .where(eq(store_customers.id, parsed.data.customer_id));
  if (!customer?.birthdate) return { ok: false };

  const year = Number(nextBirthday(customer.birthdate, localToday()).date.slice(0, 4));
  await db
    .update(store_customers)
    .set({ birthday_sent_year: year })
    .where(eq(store_customers.id, parsed.data.customer_id));
  revalidatePath("/admin/vendas-loja/clientes");
  return { ok: true };
}

export async function saveBirthdayMessageAction(input: unknown): Promise<{ ok: boolean; message?: string }> {
  const parsed = birthdayMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Mensagem inválida." };
  }

  await requireAdmin();
  // Empty goes back to the default text.
  const message = parsed.data.message || null;
  try {
    await getDb()
      .insert(store_settings)
      .values({ id: 1, birthday_message: message })
      .onConflictDoUpdate({ target: store_settings.id, set: { birthday_message: message } });
  } catch (error) {
    console.error("[saveBirthdayMessageAction]", error);
    return { ok: false, message: "Não foi possível salvar a mensagem." };
  }
  revalidatePath("/admin/vendas-loja/clientes");
  return { ok: true };
}
