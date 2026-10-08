import "server-only";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { FeedbackImageKind, Tables } from "@/lib/database.types";
import { requireAdminPage } from "@/lib/auth/guards";
import { formatCustomerName } from "@/lib/format";
import { safeQuery } from "./safe";

const { feedbacks, feedback_images } = schema;

export type FeedbackImage = {
  url: string;
  kind: FeedbackImageKind;
  width: number | null;
  height: number | null;
};

/**
 * A feedback as the storefront shows it. Built here, on the server, so the
 * customer's full name never reaches the page: only "Carlos M." does.
 */
export type FeedbackCardData = {
  id: string;
  name: string;
  location: string | null;
  text: string | null;
  rating: number | null;
  images: FeedbackImage[];
};

/** 1, 2, 3… first; then the unnumbered ones, most recent first (the
 * feedback's own date, else when it was registered). */
const FEEDBACK_ORDER: SQL[] = [
  sql`${feedbacks.position} is null`,
  asc(feedbacks.position),
  desc(sql`coalesce(${feedbacks.feedback_date}, substr(${feedbacks.created_at}, 1, 10))`),
  desc(feedbacks.created_at),
];

const PUBLIC_WITH = {
  feedback_images: {
    columns: { url: true, kind: true, width: true, height: true },
    orderBy: asc(feedback_images.position),
  },
} as const;

function toCard(row: Tables<"feedbacks"> & { feedback_images: FeedbackImage[] }): FeedbackCardData {
  return {
    id: row.id,
    name: formatCustomerName(row.customer_name),
    location: row.customer_location,
    text: row.text,
    rating: row.rating,
    images: row.feedback_images,
  };
}

/** "O que nossos clientes dizem" on the home: active, marked for the home. */
export async function getHomeFeedbacks(limit = 12): Promise<FeedbackCardData[]> {
  return safeQuery(async () => {
    const rows = await getDb().query.feedbacks.findMany({
      where: and(eq(feedbacks.active, true), eq(feedbacks.show_on_home, true)),
      with: PUBLIC_WITH,
      orderBy: FEEDBACK_ORDER,
      limit,
    });
    return rows.map(toCard);
  }, []);
}

/** The product page's carousel: active feedbacks linked to this product
 * (marked for the home or not). */
export async function getProductFeedbacks(productId: string, limit = 12): Promise<FeedbackCardData[]> {
  return safeQuery(async () => {
    const rows = await getDb().query.feedbacks.findMany({
      where: and(eq(feedbacks.active, true), eq(feedbacks.product_id, productId)),
      with: PUBLIC_WITH,
      orderBy: FEEDBACK_ORDER,
      limit,
    });
    return rows.map(toCard);
  }, []);
}

export type AdminFeedback = Tables<"feedbacks"> & {
  feedback_images: Tables<"feedback_images">[];
  product: { id: string; name: string; slug: string } | null;
};

export type FeedbackFilters = {
  /** "ativos" | "inativos" */
  status?: string;
  /** "sim" | "nao" */
  home?: string;
};

export async function getFeedbacksAdmin(filters: FeedbackFilters = {}): Promise<AdminFeedback[]> {
  await requireAdminPage();
  const conditions: SQL[] = [];
  if (filters.status === "ativos") conditions.push(eq(feedbacks.active, true));
  if (filters.status === "inativos") conditions.push(eq(feedbacks.active, false));
  if (filters.home === "sim") conditions.push(eq(feedbacks.show_on_home, true));
  if (filters.home === "nao") conditions.push(eq(feedbacks.show_on_home, false));
  return getDb().query.feedbacks.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      feedback_images: { orderBy: asc(feedback_images.position) },
      product: { columns: { id: true, name: true, slug: true } },
    },
    orderBy: FEEDBACK_ORDER,
  });
}

export async function getFeedbackByIdAdmin(id: string): Promise<AdminFeedback | null> {
  await requireAdminPage();
  const row = await getDb().query.feedbacks.findFirst({
    where: eq(feedbacks.id, id),
    with: {
      feedback_images: { orderBy: asc(feedback_images.position) },
      product: { columns: { id: true, name: true, slug: true } },
    },
  });
  return row ?? null;
}
