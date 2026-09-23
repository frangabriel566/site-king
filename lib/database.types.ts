// Hand-authored to match supabase/migrations/*.sql exactly.
//
// Once the project is linked to a live Supabase instance, regenerate with:
//   supabase gen types typescript --linked > lib/database.types.ts
// and diff against this file — the shape should not change unless a
// migration changed it.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProductStatus = "draft" | "active" | "archived";
export type ProductBadge = "lancamento" | "oferta" | "mais_vendido";
export type ProfileRole = "customer" | "admin";
export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "canceled";
export type CouponType = "percent" | "fixed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          role: ProfileRole;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          role?: ProfileRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          role?: ProfileRole;
          created_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          position: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          position?: number;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          position?: number;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          short_description: string | null;
          video_url: string | null;
          tags: string[] | null;
          collection: string | null;
          shipping_note: string | null;
          exchange_info: string | null;
          care_instructions: string | null;
          price: number;
          compare_at_price: number | null;
          category_id: string | null;
          brand_id: string | null;
          manufacturer_ref: string | null;
          attributes: Json | null;
          weight_grams: number | null;
          length_cm: number | null;
          width_cm: number | null;
          height_cm: number | null;
          badge: ProductBadge | null;
          status: ProductStatus;
          featured: boolean;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          short_description?: string | null;
          video_url?: string | null;
          tags?: string[] | null;
          collection?: string | null;
          shipping_note?: string | null;
          exchange_info?: string | null;
          care_instructions?: string | null;
          price: number;
          compare_at_price?: number | null;
          category_id?: string | null;
          brand_id?: string | null;
          manufacturer_ref?: string | null;
          attributes?: Json | null;
          weight_grams?: number | null;
          length_cm?: number | null;
          width_cm?: number | null;
          height_cm?: number | null;
          badge?: ProductBadge | null;
          status?: ProductStatus;
          featured?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          short_description?: string | null;
          video_url?: string | null;
          tags?: string[] | null;
          collection?: string | null;
          shipping_note?: string | null;
          exchange_info?: string | null;
          care_instructions?: string | null;
          price?: number;
          compare_at_price?: number | null;
          category_id?: string | null;
          brand_id?: string | null;
          manufacturer_ref?: string | null;
          attributes?: Json | null;
          weight_grams?: number | null;
          length_cm?: number | null;
          width_cm?: number | null;
          height_cm?: number | null;
          badge?: ProductBadge | null;
          status?: ProductStatus;
          featured?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_brand_id_fkey";
            columns: ["brand_id"];
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      brands: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          description: string | null;
          position: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_url?: string | null;
          description?: string | null;
          position?: number;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          logo_url?: string | null;
          description?: string | null;
          position?: number;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          url: string;
          alt: string | null;
          position: number;
        };
        Insert: {
          id?: string;
          product_id: string;
          url: string;
          alt?: string | null;
          position?: number;
        };
        Update: {
          id?: string;
          product_id?: string;
          url?: string;
          alt?: string | null;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          color: string;
          color_hex: string | null;
          size: string;
          sku: string | null;
          stock: number;
          image_url: string | null;
          weight_grams: number | null;
          length_cm: number | null;
          width_cm: number | null;
          height_cm: number | null;
        };
        Insert: {
          id?: string;
          product_id: string;
          color: string;
          color_hex?: string | null;
          size: string;
          sku?: string | null;
          stock?: number;
          image_url?: string | null;
          weight_grams?: number | null;
          length_cm?: number | null;
          width_cm?: number | null;
          height_cm?: number | null;
        };
        Update: {
          id?: string;
          product_id?: string;
          color?: string;
          color_hex?: string | null;
          size?: string;
          sku?: string | null;
          stock?: number;
          image_url?: string | null;
          weight_grams?: number | null;
          length_cm?: number | null;
          width_cm?: number | null;
          height_cm?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      banners: {
        Row: {
          id: string;
          eyebrow: string | null;
          headline_line1: string | null;
          headline_line2: string | null;
          wordmark: string | null;
          cta_label: string | null;
          cta_href: string | null;
          image_url: string | null;
          cutout_url: string | null;
          featured_product_id: string | null;
          active: boolean;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          eyebrow?: string | null;
          headline_line1?: string | null;
          headline_line2?: string | null;
          wordmark?: string | null;
          cta_label?: string | null;
          cta_href?: string | null;
          image_url?: string | null;
          cutout_url?: string | null;
          featured_product_id?: string | null;
          active?: boolean;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          eyebrow?: string | null;
          headline_line1?: string | null;
          headline_line2?: string | null;
          wordmark?: string | null;
          cta_label?: string | null;
          cta_href?: string | null;
          image_url?: string | null;
          cutout_url?: string | null;
          featured_product_id?: string | null;
          active?: boolean;
          position?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "banners_featured_product_id_fkey";
            columns: ["featured_product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      site_settings: {
        Row: {
          id: number;
          store_name: string;
          logo_url: string | null;
          whatsapp: string | null;
          email: string | null;
          instagram: string | null;
          tiktok: string | null;
          youtube: string | null;
          shipping_note: string | null;
          free_shipping_note: string | null;
          announcement: string | null;
          origin_document: string | null;
          origin_cep: string | null;
          origin_street: string | null;
          origin_number: string | null;
          origin_complement: string | null;
          origin_district: string | null;
          origin_city: string | null;
          origin_state: string | null;
          announcement_active: boolean;
        };
        Insert: {
          id?: number;
          store_name?: string;
          logo_url?: string | null;
          whatsapp?: string | null;
          email?: string | null;
          instagram?: string | null;
          tiktok?: string | null;
          youtube?: string | null;
          shipping_note?: string | null;
          free_shipping_note?: string | null;
          announcement?: string | null;
          origin_document?: string | null;
          origin_cep?: string | null;
          origin_street?: string | null;
          origin_number?: string | null;
          origin_complement?: string | null;
          origin_district?: string | null;
          origin_city?: string | null;
          origin_state?: string | null;
          announcement_active?: boolean;
        };
        Update: {
          id?: number;
          store_name?: string;
          logo_url?: string | null;
          whatsapp?: string | null;
          email?: string | null;
          instagram?: string | null;
          tiktok?: string | null;
          youtube?: string | null;
          shipping_note?: string | null;
          free_shipping_note?: string | null;
          announcement?: string | null;
          origin_document?: string | null;
          origin_cep?: string | null;
          origin_street?: string | null;
          origin_number?: string | null;
          origin_complement?: string | null;
          origin_district?: string | null;
          origin_city?: string | null;
          origin_state?: string | null;
          announcement_active?: boolean;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          name: string;
          phone: string;
          birthdate: string;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          phone: string;
          birthdate: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string;
          birthdate?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      addresses: {
        Row: {
          id: string;
          customer_id: string;
          cep: string;
          street: string;
          number: string;
          complement: string | null;
          district: string;
          city: string;
          state: string;
          is_default: boolean;
        };
        Insert: {
          id?: string;
          customer_id: string;
          cep: string;
          street: string;
          number: string;
          complement?: string | null;
          district: string;
          city: string;
          state: string;
          is_default?: boolean;
        };
        Update: {
          id?: string;
          customer_id?: string;
          cep?: string;
          street?: string;
          number?: string;
          complement?: string | null;
          district?: string;
          city?: string;
          state?: string;
          is_default?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "addresses_customer_id_fkey";
            columns: ["customer_id"];
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          order_number: number;
          customer_id: string | null;
          status: OrderStatus;
          subtotal: number;
          shipping: number;
          discount: number;
          total: number;
          payment_method: string | null;
          payment_id: string | null;
          tracking_code: string | null;
          shipping_service: string | null;
          melhorenvio_order_id: string | null;
          label_url: string | null;
          shipping_address: Json | null;
          customer_snapshot: Json | null;
          stock_decremented_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number?: number;
          customer_id?: string | null;
          status?: OrderStatus;
          subtotal?: number;
          shipping?: number;
          discount?: number;
          total?: number;
          payment_method?: string | null;
          payment_id?: string | null;
          tracking_code?: string | null;
          shipping_service?: string | null;
          melhorenvio_order_id?: string | null;
          label_url?: string | null;
          shipping_address?: Json | null;
          customer_snapshot?: Json | null;
          stock_decremented_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_number?: number;
          customer_id?: string | null;
          status?: OrderStatus;
          subtotal?: number;
          shipping?: number;
          discount?: number;
          total?: number;
          payment_method?: string | null;
          payment_id?: string | null;
          tracking_code?: string | null;
          shipping_service?: string | null;
          melhorenvio_order_id?: string | null;
          label_url?: string | null;
          shipping_address?: Json | null;
          customer_snapshot?: Json | null;
          stock_decremented_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          variant_id: string | null;
          name: string;
          color: string | null;
          size: string | null;
          unit_price: number;
          qty: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          variant_id?: string | null;
          name: string;
          color?: string | null;
          size?: string | null;
          unit_price: number;
          qty: number;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string | null;
          variant_id?: string | null;
          name?: string;
          color?: string | null;
          size?: string | null;
          unit_price?: number;
          qty?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_variant_id_fkey";
            columns: ["variant_id"];
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      newsletter_subscribers: {
        Row: {
          id: string;
          email: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      coupons: {
        Row: {
          id: string;
          code: string;
          type: CouponType;
          value: number;
          min_total: number;
          active: boolean;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          type: CouponType;
          value: number;
          min_total?: number;
          active?: boolean;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          type?: CouponType;
          value?: number;
          min_total?: number;
          active?: boolean;
          expires_at?: string | null;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          product_id: string;
          customer_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          customer_id: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          customer_id?: string;
          rating?: number;
          comment?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      fulfill_order_stock: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
      validate_coupon: {
        Args: { p_code: string; p_subtotal: number };
        Returns: {
          id: string;
          code: string;
          type: CouponType;
          value: number;
          discount: number;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];
