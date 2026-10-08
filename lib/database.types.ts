// Row types for the app, derived from the Drizzle schema (lib/db/schema.ts).
//
// Kept under the names the Supabase-generated file used (`Tables<"products">`,
// `OrderStatus`, …) so components did not have to change when the database
// moved to Cloudflare D1. The schema is the source of truth; this file only
// renames.
import type * as schema from "@/lib/db/schema";

export type {
  CouponType,
  CustomerSnapshot,
  Json,
  OrderStatus,
  ProductBadge,
  ProductSection,
  FeedbackImageKind,
  ProductStatus,
  ShippingAddressSnapshot,
  UserRole as ProfileRole,
} from "@/lib/db/schema";

type TableMap = {
  categories: typeof schema.categories;
  brands: typeof schema.brands;
  products: typeof schema.products;
  product_images: typeof schema.product_images;
  product_variants: typeof schema.product_variants;
  product_sections: typeof schema.product_sections;
  feedbacks: typeof schema.feedbacks;
  feedback_images: typeof schema.feedback_images;
  banners: typeof schema.banners;
  site_settings: typeof schema.site_settings;
  customers: typeof schema.customers;
  addresses: typeof schema.addresses;
  orders: typeof schema.orders;
  order_items: typeof schema.order_items;
  coupons: typeof schema.coupons;
  reviews: typeof schema.reviews;
  newsletter_subscribers: typeof schema.newsletter_subscribers;
};

export type Tables<T extends keyof TableMap> = TableMap[T]["$inferSelect"];
export type TablesInsert<T extends keyof TableMap> = TableMap[T]["$inferInsert"];
