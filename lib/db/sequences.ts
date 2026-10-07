import { sql } from "drizzle-orm";
import { counters, orders } from "./schema";

/**
 * SQLite has no sequences, so the two counters this app needs are SQL
 * expressions evaluated inside the INSERT itself. D1 executes writes one
 * at a time, so nothing can slip in between the read and the write; the
 * unique indexes on `order_number` and `code` are the backstop anyway.
 */

/** Next `orders.order_number`. */
export const nextOrderNumber = sql<number>`(select coalesce(max(${orders.order_number}), 0) + 1 from ${orders})`;

export const WHATSAPP_CODE_COUNTER = "whatsapp_order_code";

/** The KS0001 code for the counter's current value — run after bumping it
 * (`bumpCounter`) in the same batch. */
export const currentWhatsAppCode = sql<string>`('KS' || printf('%04d', (select ${counters.value} from ${counters} where ${counters.name} = ${WHATSAPP_CODE_COUNTER})))`;
