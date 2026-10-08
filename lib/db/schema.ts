/**
 * The whole database, as Drizzle tables for Cloudflare D1 (SQLite).
 *
 * Ported 1:1 from the old Supabase migrations, with SQLite's limits worked
 * around the same way everywhere:
 * - uuids are `text`, generated in the app (`crypto.randomUUID()`);
 * - money is `real`, rounded to 2 places on write (lib/money.ts) — the
 *   app always handled prices as JS numbers anyway;
 * - app timestamps are ISO-8601 text in UTC, so `created_at.slice(0, 10)`
 *   and string comparisons keep working; Better Auth's own tables use
 *   integer milliseconds, which is what its adapter expects;
 * - jsonb and text[] are `text` in Drizzle's JSON mode;
 * - Postgres enums/checks are SQLite CHECK constraints plus a TS union.
 *
 * Row Level Security has no equivalent here. Who may read or write what is
 * enforced in server code — see lib/auth/guards.ts.
 *
 * Change this file, then `npm run db:generate` to write a migration.
 */
import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { PRODUCT_SECTIONS } from "../sections";
import { SHIPPING_MODES } from "../shipping-mode";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export const PRODUCT_STATUSES = ["draft", "active", "archived"] as const;
export const PRODUCT_BADGES = ["lancamento", "oferta", "mais_vendido"] as const;
// The storefront's product shelves live in lib/sections.ts (relative
// import: drizzle-kit reads this file too), so the browser can use the
// list without pulling the database schema into its bundle.
export { PRODUCT_SECTIONS, type ProductSection } from "../sections";
export { SHIPPING_MODES, type ShippingMode } from "../shipping-mode";
export const USER_ROLES = ["customer", "admin"] as const;
export const ORDER_STATUSES = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "canceled",
  // Compra direta pelo WhatsApp: o pedido existe, a conversa ainda não
  // fechou. `expirado` é o mesmo pedido depois das 48h.
  "aguardando_whatsapp",
  "expirado",
] as const;
export const COUPON_TYPES = ["percent", "fixed"] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export type ProductBadge = (typeof PRODUCT_BADGES)[number];
export type UserRole = (typeof USER_ROLES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type CouponType = (typeof COUPON_TYPES)[number];

export type ShippingAddressSnapshot = {
  cep: string;
  street: string;
  number: string;
  complement?: string | null;
  district: string;
  city: string;
  state: string;
  is_default?: boolean;
};

export type CustomerSnapshot = {
  name?: string;
  email?: string | null;
  phone?: string;
};

/** A category's size chart (Admin → Categorias), shown in the product
 * page's "Guia de medidas". Free columns, one row per size; every cell is
 * text, so "88–96" or "70 cm" stay as the store typed them. */
export type SizeGuide = {
  columns: string[];
  rows: string[][];
  /** A line under the table, e.g. "Medidas do corpo, em centímetros". */
  note?: string | null;
};

/** `strftime` with `%f` gives milliseconds, so rows written by plain SQL
 * (the seed, a console fix) match `new Date().toISOString()` exactly. */
const isoNow = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
const msNow = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

const uuid = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(isoNow)
    .$defaultFn(() => new Date().toISOString());

const updatedAt = () =>
  text("updated_at")
    .notNull()
    .default(isoNow)
    .$defaultFn(() => new Date().toISOString())
    .$onUpdateFn(() => new Date().toISOString());

const bool = (name: string) => integer(name, { mode: "boolean" });

// ------------------------------------------------------------------
// Better Auth — user (replaces Supabase's auth.users + public.profiles),
// session, account (holds the password hash), verification (reset tokens)
// ------------------------------------------------------------------

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: bool("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role", { enum: USER_ROLES }).notNull().default("customer"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(msNow),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(msNow)
    .$onUpdate(() => new Date()),
}, (t) => [check("user_role_check", sql`${t.role} in ('customer', 'admin')`)]);

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(msNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(msNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(msNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(msNow)
      .$onUpdate(() => new Date()),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ------------------------------------------------------------------
// catalog
// ------------------------------------------------------------------

export const categories = sqliteTable(
  "categories",
  {
    id: uuid(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    position: integer("position").notNull().default(0),
    active: bool("active").notNull().default(true),
    created_at: createdAt(),
    /** Photo for the home's category circles and the mobile menu. Null:
     * the first product's photo stands in (getCategoriesWithImages). */
    image_url: text("image_url"),
    /** Null: the product page shows no size guide for this category. */
    size_guide: text("size_guide", { mode: "json" }).$type<SizeGuide>(),
  },
  (t) => [index("categories_active_position_idx").on(t.active, t.position)],
);

export const brands = sqliteTable(
  "brands",
  {
    id: uuid(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo_url: text("logo_url"),
    description: text("description"),
    position: integer("position").notNull().default(0),
    active: bool("active").notNull().default(true),
    created_at: createdAt(),
  },
  (t) => [index("brands_active_position_idx").on(t.active, t.position)],
);

export const products = sqliteTable(
  "products",
  {
    id: uuid(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    short_description: text("short_description"),
    video_url: text("video_url"),
    tags: text("tags", { mode: "json" }).$type<string[]>(),
    collection: text("collection"),
    shipping_note: text("shipping_note"),
    exchange_info: text("exchange_info"),
    care_instructions: text("care_instructions"),
    price: real("price").notNull(),
    compare_at_price: real("compare_at_price"),
    category_id: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    brand_id: text("brand_id").references(() => brands.id, { onDelete: "set null" }),
    manufacturer_ref: text("manufacturer_ref"),
    attributes: text("attributes", { mode: "json" }).$type<Json>(),
    // Package spec for the Melhor Envio quote (one per product).
    weight_grams: integer("weight_grams"),
    length_cm: real("length_cm"),
    width_cm: real("width_cm"),
    height_cm: real("height_cm"),
    badge: text("badge", { enum: PRODUCT_BADGES }),
    status: text("status", { enum: PRODUCT_STATUSES }).notNull().default("draft"),
    featured: bool("featured").notNull().default(false),
    position: integer("position").notNull().default(0),
    /** Name, brand and category, lowercased and without accents — what the
     * search box matches against (lib/search-text.ts). Rewritten on every
     * product save and whenever its brand or category is renamed. */
    search_text: text("search_text").notNull().default(""),
    /** Deleted in the panel after it was sold: kept because orders point
     * at it (lib/products/delete.ts). Status "archived", slug moved aside,
     * variants archived — invisible in the store and the panel, photos
     * kept. Null for every product still in the catalogue. */
    deleted_at: text("deleted_at"),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    index("products_status_idx").on(t.status),
    index("products_category_id_idx").on(t.category_id),
    index("products_brand_id_idx").on(t.brand_id),
    index("products_status_badge_idx").on(t.status, t.badge),
    check("products_price_check", sql`${t.price} >= 0`),
    check(
      "products_compare_at_price_check",
      sql`${t.compare_at_price} is null or ${t.compare_at_price} >= 0`,
    ),
    check(
      "products_badge_check",
      sql`${t.badge} is null or ${t.badge} in ('lancamento', 'oferta', 'mais_vendido')`,
    ),
    check("products_status_check", sql`${t.status} in ('draft', 'active', 'archived')`),
    check("products_weight_grams_check", sql`${t.weight_grams} is null or ${t.weight_grams} > 0`),
    check("products_length_cm_check", sql`${t.length_cm} is null or ${t.length_cm} > 0`),
    check("products_width_cm_check", sql`${t.width_cm} is null or ${t.width_cm} > 0`),
    check("products_height_cm_check", sql`${t.height_cm} is null or ${t.height_cm} > 0`),
  ],
);

export const product_images = sqliteTable(
  "product_images",
  {
    id: uuid(),
    product_id: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("product_images_product_id_idx").on(t.product_id, t.position)],
);

/**
 * Which storefront shelves a product is on — chosen in the panel, never
 * worked out from dates or prices. A row per (product, shelf): none, one
 * or several. `position` orders the shelf (1 first; null after the
 * numbered ones, newest first).
 *
 * A table rather than a boolean per shelf on products: the order is per
 * shelf (booleans would need a position column each, eight columns), a
 * shelf's products are one indexed lookup, and a new shelf is a value in
 * the list instead of two more columns.
 */
export const product_sections = sqliteTable(
  "product_sections",
  {
    product_id: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    section: text("section", { enum: PRODUCT_SECTIONS }).notNull(),
    position: integer("position"),
    created_at: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.product_id, t.section] }),
    index("product_sections_section_idx").on(t.section, t.position),
    check(
      "product_sections_section_check",
      sql`${t.section} in ('lancamentos', 'novidades', 'ofertas', 'mais_vendidos')`,
    ),
    check("product_sections_position_check", sql`${t.position} is null or ${t.position} >= 1`),
  ],
);

export const product_variants = sqliteTable(
  "product_variants",
  {
    id: uuid(),
    product_id: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    color: text("color").notNull(),
    color_hex: text("color_hex"),
    size: text("size").notNull(),
    sku: text("sku").unique(),
    stock: integer("stock").notNull().default(0),
    image_url: text("image_url"),
    /** Removed from the product in the panel but kept because orders point
     * at it (lib/products/variant-sync.ts). Invisible everywhere in the
     * store and the panel; null for every live variant. */
    archived_at: text("archived_at"),
  },
  (t) => [
    uniqueIndex("product_variants_product_color_size_idx").on(t.product_id, t.color, t.size),
    index("product_variants_product_id_idx").on(t.product_id),
    // What makes every stock decrement safe: an UPDATE that would take a
    // variant below zero fails, and the D1 batch around it rolls back.
    check("product_variants_stock_check", sql`${t.stock} >= 0`),
  ],
);

export const banners = sqliteTable(
  "banners",
  {
    id: uuid(),
    eyebrow: text("eyebrow"),
    headline_line1: text("headline_line1"),
    headline_line2: text("headline_line2"),
    wordmark: text("wordmark"),
    cta_label: text("cta_label"),
    cta_href: text("cta_href"),
    image_url: text("image_url"),
    cutout_url: text("cutout_url"),
    featured_product_id: text("featured_product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    active: bool("active").notNull().default(false),
    position: integer("position").notNull().default(0),
    created_at: createdAt(),
  },
  (t) => [index("banners_active_position_idx").on(t.active, t.position)],
);

/** Single row (id = 1). */
export const site_settings = sqliteTable(
  "site_settings",
  {
    id: integer("id").primaryKey().default(1),
    store_name: text("store_name").notNull().default("King Store"),
    logo_url: text("logo_url"),
    whatsapp: text("whatsapp"),
    email: text("email"),
    instagram: text("instagram"),
    tiktok: text("tiktok"),
    youtube: text("youtube"),
    shipping_note: text("shipping_note"),
    free_shipping_note: text("free_shipping_note"),
    announcement: text("announcement"),
    announcement_active: bool("announcement_active").notNull().default(false),
    // Where parcels ship from (Melhor Envio sender).
    origin_document: text("origin_document"),
    origin_cep: text("origin_cep"),
    origin_street: text("origin_street"),
    origin_number: text("origin_number"),
    origin_complement: text("origin_complement"),
    origin_district: text("origin_district"),
    origin_city: text("origin_city"),
    origin_state: text("origin_state"),
    // Storefront selling rules (Configurações → Vitrine). Every one is
    // optional: left empty, the storefront simply doesn't show the line or
    // badge it drives — nothing is shown that the store hasn't set.
    /** "3x de R$ 33,30 sem juros". Null or < 2: no installment line. */
    installments_max: integer("installments_max"),
    /** Pix price shown next to the regular one. Display only — the online
     * checkout does not apply it by itself. */
    pix_discount_percent: real("pix_discount_percent"),
    /** Orders from this subtotal ship free (checkout and the bag's progress
     * bar). Null: no free shipping. */
    free_shipping_threshold: real("free_shipping_threshold"),
    /** "Novo" badge for products created within this many days. */
    new_product_days: integer("new_product_days"),
    /** "Últimas unidades" when a product's stock, summed over its
     * variants, is at most this. */
    low_stock_units: integer("low_stock_units"),
    /** Trust strip under the buy button. */
    exchange_note: text("exchange_note"),
    /** Shown while the store takes payment online (lib/sales-mode.ts)… */
    secure_purchase_note: text("secure_purchase_note"),
    /** …and this one while it sells only over WhatsApp. */
    secure_purchase_note_whatsapp: text("secure_purchase_note_whatsapp"),
    // The footer's bottom line (Configurações → Rodapé). Each one shows
    // only when filled in; the payment one has a version per sales mode,
    // like the purchase note above.
    footer_payment_text: text("footer_payment_text"),
    footer_payment_text_whatsapp: text("footer_payment_text_whatsapp"),
    footer_security_text: text("footer_security_text"),
    footer_privacy_text: text("footer_privacy_text"),
  },
  (t) => [check("site_settings_single_row", sql`${t.id} = 1`)],
);

// ------------------------------------------------------------------
// customers, orders
// ------------------------------------------------------------------

/** Checkout/registration data. One row per user who completed signup. */
export const customers = sqliteTable("customers", {
  id: text("id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  /** YYYY-MM-DD */
  birthdate: text("birthdate").notNull(),
  created_at: createdAt(),
});

export const addresses = sqliteTable(
  "addresses",
  {
    id: uuid(),
    customer_id: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    cep: text("cep").notNull(),
    street: text("street").notNull(),
    number: text("number").notNull(),
    complement: text("complement"),
    district: text("district").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    is_default: bool("is_default").notNull().default(false),
  },
  (t) => [index("addresses_customer_id_idx").on(t.customer_id)],
);

export const orders = sqliteTable(
  "orders",
  {
    id: uuid(),
    /** Sequential, human-facing number. Filled with `max + 1` inside the
     * INSERT itself (lib/db/sequences.ts) — D1 runs writes one at a
     * time, and the unique index is the backstop. */
    order_number: integer("order_number").notNull().unique(),
    customer_id: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    status: text("status", { enum: ORDER_STATUSES }).notNull().default("pending"),
    subtotal: real("subtotal").notNull().default(0),
    shipping: real("shipping").notNull().default(0),
    /** Whether `shipping` is a charge, free, or still to be agreed on
     * WhatsApp (lib/shipping-mode.ts). The default keeps the old meaning —
     * `shipping` is what was charged — for a row written without it. */
    shipping_mode: text("shipping_mode", { enum: SHIPPING_MODES }).notNull().default("charged"),
    discount: real("discount").notNull().default(0),
    total: real("total").notNull().default(0),
    payment_method: text("payment_method"),
    payment_id: text("payment_id"),
    tracking_code: text("tracking_code"),
    shipping_address: text("shipping_address", { mode: "json" }).$type<ShippingAddressSnapshot>(),
    customer_snapshot: text("customer_snapshot", { mode: "json" }).$type<CustomerSnapshot>(),
    /** Idempotency guard for the stock decrement: set once, the first time
     * the order is fulfilled, so a webhook retry is a no-op. */
    stock_decremented_at: text("stock_decremented_at"),
    /** WhatsApp purchase code (KS0001). Null on every other order. */
    code: text("code").unique(),
    expires_at: text("expires_at"),
    shipping_service: text("shipping_service"),
    /** Also the idempotency key for buying a label. */
    melhorenvio_order_id: text("melhorenvio_order_id").unique(),
    /** The coupon this order used (its code, as typed by the store), or
     * null. `discount` holds the amount. */
    coupon_code: text("coupon_code"),
    /** When this order's coupon use was counted (the sale confirmed or
     * paid); null while it hasn't been, or after it was given back. Also
     * what makes counting and giving back idempotent. */
    coupon_used_at: text("coupon_used_at"),
    /** The customer's phone, digits only with DDD — typed by the store when
     * it confirms a WhatsApp sale (optional). What "um uso por telefone"
     * compares. */
    customer_phone: text("customer_phone"),
    label_url: text("label_url"),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    index("orders_customer_id_idx").on(t.customer_id),
    index("orders_status_idx").on(t.status),
    index("orders_payment_id_idx").on(t.payment_id),
    index("orders_created_at_idx").on(t.created_at),
    index("orders_coupon_phone_idx").on(t.coupon_code, t.customer_phone),
    index("orders_whatsapp_pending_idx")
      .on(t.expires_at)
      .where(sql`${t.status} = 'aguardando_whatsapp'`),
    check(
      "orders_status_check",
      sql`${t.status} in ('pending', 'paid', 'processing', 'shipped', 'delivered', 'canceled', 'aguardando_whatsapp', 'expirado')`,
    ),
  ],
);

/** Snapshot of name/price at time of purchase. */
export const order_items = sqliteTable(
  "order_items",
  {
    id: uuid(),
    order_id: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    product_id: text("product_id").references(() => products.id, { onDelete: "set null" }),
    variant_id: text("variant_id").references(() => product_variants.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    color: text("color"),
    size: text("size"),
    unit_price: real("unit_price").notNull(),
    qty: integer("qty").notNull(),
  },
  (t) => [
    index("order_items_order_id_idx").on(t.order_id),
    check("order_items_qty_check", sql`${t.qty} > 0`),
  ],
);

export const coupons = sqliteTable(
  "coupons",
  {
    id: uuid(),
    code: text("code").notNull().unique(),
    type: text("type", { enum: COUPON_TYPES }).notNull(),
    value: real("value").notNull(),
    min_total: real("min_total").notNull().default(0),
    active: bool("active").notNull().default(true),
    /** First and last day the coupon works (YYYY-MM-DD, whole days in
     * Brasília time — lib/coupons/rules.ts). Null: no limit on that side. */
    starts_at: text("starts_at"),
    expires_at: text("expires_at"),
    /** Null: unlimited. */
    max_uses: integer("max_uses"),
    /** Confirmed orders that used it: counted when the sale is confirmed
     * (or paid), given back when that order is canceled — an order still
     * waiting, expired or abandoned never spends a use
     * (lib/coupons/usage.ts, orders.coupon_used_at). */
    used_count: integer("used_count").notNull().default(0),
    /** Also zeroes the shipping. */
    free_shipping: bool("free_shipping").notNull().default(false),
    /** One confirmed use per customer phone (typed by the store when it
     * confirms the sale). Repeats are flagged, not blocked. */
    one_per_phone: bool("one_per_phone").notNull().default(false),
    created_at: createdAt(),
  },
  (t) => [
    check("coupons_type_check", sql`${t.type} in ('percent', 'fixed')`),
    check("coupons_value_check", sql`${t.value} >= 0`),
    // The limit lives here so two orders racing for the last use can't
    // both get it: the second one's increment fails and its whole batch
    // (order included) rolls back.
    check(
      "coupons_usage_check",
      sql`${t.used_count} >= 0 and (${t.max_uses} is null or ${t.used_count} <= ${t.max_uses})`,
    ),
  ],
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: uuid(),
    product_id: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** Any signed-in user can review, not only those with a customers row. */
    customer_id: text("customer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    created_at: createdAt(),
  },
  (t) => [
    uniqueIndex("reviews_product_customer_idx").on(t.product_id, t.customer_id),
    index("reviews_product_id_idx").on(t.product_id),
    check("reviews_rating_check", sql`${t.rating} between 1 and 5`),
  ],
);

/** What a feedback image is: the customer's own photo, or a screenshot of
 * the conversation (shown top-aligned in the card, readable full screen). */
export const FEEDBACK_IMAGE_KINDS = ["photo", "chat"] as const;
export type FeedbackImageKind = (typeof FEEDBACK_IMAGE_KINDS)[number];

/**
 * Customer feedback the store publishes from the panel (Admin → Feedbacks):
 * a quote, photos/screenshots, or both. Picked by the store, so it never
 * feeds structured data — the product's AggregateRating comes from
 * `reviews` only. "At least text or one image" spans two tables, so it is
 * enforced when saving (lib/validations/feedback.ts), not by a CHECK.
 */
export const feedbacks = sqliteTable(
  "feedbacks",
  {
    id: uuid(),
    /** Full name as typed; the site shows "Carlos M." (formatCustomerName). */
    customer_name: text("customer_name").notNull(),
    customer_location: text("customer_location"),
    text: text("text"),
    rating: integer("rating"),
    product_id: text("product_id").references(() => products.id, { onDelete: "set null" }),
    show_on_home: bool("show_on_home").notNull().default(false),
    active: bool("active").notNull().default(true),
    /** 1 first; null after the numbered ones, most recent first. */
    position: integer("position"),
    /** YYYY-MM-DD — when the customer sent it. */
    feedback_date: text("feedback_date"),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    index("feedbacks_home_idx").on(t.active, t.show_on_home, t.position),
    index("feedbacks_product_idx").on(t.product_id, t.active),
    check("feedbacks_rating_check", sql`${t.rating} is null or ${t.rating} between 1 and 5`),
    check("feedbacks_position_check", sql`${t.position} is null or ${t.position} >= 1`),
  ],
);

export const feedback_images = sqliteTable(
  "feedback_images",
  {
    id: uuid(),
    feedback_id: text("feedback_id")
      .notNull()
      .references(() => feedbacks.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    kind: text("kind", { enum: FEEDBACK_IMAGE_KINDS }).notNull().default("photo"),
    position: integer("position").notNull().default(0),
    width: integer("width"),
    height: integer("height"),
  },
  (t) => [
    index("feedback_images_feedback_idx").on(t.feedback_id, t.position),
    check("feedback_images_kind_check", sql`${t.kind} in ('photo', 'chat')`),
  ],
);

export const newsletter_subscribers = sqliteTable("newsletter_subscribers", {
  id: uuid(),
  email: text("email").notNull().unique(),
  created_at: createdAt(),
});

export const INTEGRATION_PROVIDERS = ["mercadopago", "melhorenvio"] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];
export const INTEGRATION_ENVIRONMENTS = ["test", "production"] as const;
export type IntegrationEnvironment = (typeof INTEGRATION_ENVIRONMENTS)[number];

/**
 * Mercado Pago and Melhor Envio, as set up in Admin → Integrações — one
 * row per service, written only by the panel (lib/integrations). Takes
 * priority over the old environment variables, which stay as a fallback
 * while no credentials are saved here.
 */
export const integrations = sqliteTable(
  "integrations",
  {
    provider: text("provider", { enum: INTEGRATION_PROVIDERS }).primaryKey(),
    /** Teste/Produção (Melhor Envio: Sandbox/Produção). */
    environment: text("environment", { enum: INTEGRATION_ENVIRONMENTS }).notNull().default("test"),
    /** The tokens, AES-GCM encrypted with the INTEGRATIONS_KEY secret
     * (lib/integrations/crypto.ts). Never sent to the browser. */
    secrets: text("secrets"),
    /** The last 4 characters of each token, for "••••3f9a". */
    hints: text("hints", { mode: "json" }).$type<Record<string, string>>(),
    /** What isn't secret (Melhor Envio's contact e-mail). */
    options: text("options", { mode: "json" }).$type<Record<string, string>>(),
    /** On only after a passing test of the saved credentials; saving new
     * ones turns it off again. */
    active: bool("active").notNull().default(false),
    test_ok: bool("test_ok").notNull().default(false),
    tested_at: text("tested_at"),
    /** What the last test said (account, environment, or the error),
     * never a token. */
    test_message: text("test_message"),
    updated_at: text("updated_at"),
    /** The admin's e-mail. */
    updated_by: text("updated_by"),
  },
  (t) => [
    check("integrations_provider_check", sql`${t.provider} in ('mercadopago', 'melhorenvio')`),
    check("integrations_environment_check", sql`${t.environment} in ('test', 'production')`),
  ],
);

/** Who changed an integration, what and when — never the values. */
export const integration_log = sqliteTable(
  "integration_log",
  {
    id: uuid(),
    provider: text("provider", { enum: INTEGRATION_PROVIDERS }).notNull(),
    action: text("action").notNull(),
    actor_email: text("actor_email"),
    created_at: createdAt(),
  },
  (t) => [index("integration_log_created_at_idx").on(t.created_at)],
);

/** Failed attempts per client per minute (lib/rate-limit.ts) — today the
 * coupon check. `key` is a hash, never the raw IP; rows are a few minutes
 * old at most. */
export const rate_limits = sqliteTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    /** Start of the minute, in ms. */
    window_start: integer("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.window_start] })],
);

/** Named sequences (SQLite has none). `whatsapp_order_code` numbers KS0001. */
export const counters = sqliteTable("counters", {
  name: text("name").primaryKey(),
  value: integer("value").notNull(),
});

// ------------------------------------------------------------------
// relations — what `db.query.*.findMany({ with: … })` can embed
// ------------------------------------------------------------------

export const userRelations = relations(user, ({ one }) => ({
  customer: one(customers, { fields: [user.id], references: [customers.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.category_id], references: [categories.id] }),
  brand: one(brands, { fields: [products.brand_id], references: [brands.id] }),
  product_images: many(product_images),
  product_variants: many(product_variants),
  product_sections: many(product_sections),
  reviews: many(reviews),
}));

export const productSectionsRelations = relations(product_sections, ({ one }) => ({
  product: one(products, { fields: [product_sections.product_id], references: [products.id] }),
}));

export const productImagesRelations = relations(product_images, ({ one }) => ({
  product: one(products, { fields: [product_images.product_id], references: [products.id] }),
}));

export const productVariantsRelations = relations(product_variants, ({ one }) => ({
  product: one(products, { fields: [product_variants.product_id], references: [products.id] }),
}));

export const bannersRelations = relations(banners, ({ one }) => ({
  featured_product: one(products, {
    fields: [banners.featured_product_id],
    references: [products.id],
  }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  user: one(user, { fields: [customers.id], references: [user.id] }),
  addresses: many(addresses),
  orders: many(orders),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  customer: one(customers, { fields: [addresses.customer_id], references: [customers.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, { fields: [orders.customer_id], references: [customers.id] }),
  order_items: many(order_items),
}));

export const orderItemsRelations = relations(order_items, ({ one }) => ({
  order: one(orders, { fields: [order_items.order_id], references: [orders.id] }),
}));

export const feedbacksRelations = relations(feedbacks, ({ one, many }) => ({
  product: one(products, { fields: [feedbacks.product_id], references: [products.id] }),
  feedback_images: many(feedback_images),
}));

export const feedbackImagesRelations = relations(feedback_images, ({ one }) => ({
  feedback: one(feedbacks, { fields: [feedback_images.feedback_id], references: [feedbacks.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, { fields: [reviews.product_id], references: [products.id] }),
  // Same id as the user; a review by someone without a customers row
  // (an admin, say) simply has no `customer`.
  customer: one(customers, { fields: [reviews.customer_id], references: [customers.id] }),
}));
