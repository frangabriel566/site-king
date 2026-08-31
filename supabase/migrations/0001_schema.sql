-- King Store — 0001_schema.sql
-- Core tables. No RLS, policies or business-logic functions here — see
-- 0002_rls.sql, 0003_functions.sql and 0004_storage.sql.

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------
-- profiles — one row per auth.users, holds the customer/admin role
-- ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- categories
-- ------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index categories_active_position_idx on public.categories (active, position);

-- ------------------------------------------------------------------
-- products
-- ------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  compare_at_price numeric(10, 2) check (compare_at_price is null or compare_at_price >= 0),
  category_id uuid references public.categories (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  featured boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_status_idx on public.products (status);
create index products_category_id_idx on public.products (category_id);
create index products_featured_idx on public.products (featured) where featured = true;

-- ------------------------------------------------------------------
-- product_images
-- ------------------------------------------------------------------
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  url text not null,
  alt text,
  position int not null default 0
);

create index product_images_product_id_idx on public.product_images (product_id, position);

-- ------------------------------------------------------------------
-- product_variants
-- ------------------------------------------------------------------
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  color text not null,
  color_hex text,
  size text not null,
  sku text unique,
  stock int not null default 0 check (stock >= 0),
  unique (product_id, color, size)
);

create index product_variants_product_id_idx on public.product_variants (product_id);

-- ------------------------------------------------------------------
-- banners — hero content, editable from the admin panel
-- ------------------------------------------------------------------
create table public.banners (
  id uuid primary key default gen_random_uuid(),
  eyebrow text,
  headline_line1 text,
  headline_line2 text,
  wordmark text,
  cta_label text,
  cta_href text,
  image_url text,
  cutout_url text,
  featured_product_id uuid references public.products (id) on delete set null,
  active boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index banners_active_position_idx on public.banners (active, position);

-- ------------------------------------------------------------------
-- site_settings — single row (id = 1)
-- ------------------------------------------------------------------
create table public.site_settings (
  id int primary key default 1 check (id = 1),
  store_name text not null default 'King Store',
  logo_url text,
  whatsapp text,
  email text,
  instagram text,
  tiktok text,
  youtube text,
  shipping_note text,
  free_shipping_note text,
  announcement text,
  announcement_active boolean not null default false
);

-- ------------------------------------------------------------------
-- customers — required checkout/registration data
-- ------------------------------------------------------------------
create table public.customers (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  phone text not null,
  birthdate date not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- addresses
-- ------------------------------------------------------------------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  cep text not null,
  street text not null,
  number text not null,
  complement text,
  district text not null,
  city text not null,
  state text not null,
  is_default boolean not null default false
);

create index addresses_customer_id_idx on public.addresses (customer_id);

-- ------------------------------------------------------------------
-- orders
-- ------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number serial unique,
  customer_id uuid references public.customers (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'processing', 'shipped', 'delivered', 'canceled')),
  subtotal numeric(10, 2) not null default 0,
  shipping numeric(10, 2) not null default 0,
  discount numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  payment_method text,
  payment_id text,
  tracking_code text,
  shipping_address jsonb,
  customer_snapshot jsonb,
  -- idempotency guard for the stock-decrement function: set once, the
  -- first time an order is fulfilled, so a webhook retry is a no-op.
  stock_decremented_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_customer_id_idx on public.orders (customer_id);
create index orders_status_idx on public.orders (status);
create index orders_payment_id_idx on public.orders (payment_id);

-- ------------------------------------------------------------------
-- order_items — snapshot of name/price at time of purchase
-- ------------------------------------------------------------------
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  name text not null,
  color text,
  size text,
  unit_price numeric(10, 2) not null,
  qty int not null check (qty > 0)
);

create index order_items_order_id_idx on public.order_items (order_id);

-- ------------------------------------------------------------------
-- coupons
-- ------------------------------------------------------------------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('percent', 'fixed')),
  value numeric(10, 2) not null check (value >= 0),
  min_total numeric(10, 2) not null default 0,
  active boolean not null default true,
  expires_at timestamptz
);
