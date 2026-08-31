-- King Store — 0002_rls.sql
-- is_admin() helper + Row Level Security policies for every table.
--
-- Baseline: public/anon can only ever READ published, active content.
-- All writes require an authenticated admin, except a customer's own
-- orders/addresses/customer record, which the owner may read and write.

-- ------------------------------------------------------------------
-- helper: is_admin()
-- security definer so it can read public.profiles even when the
-- calling role's own RLS on profiles would otherwise block it
-- (avoids recursive-policy deadlock on the profiles table itself).
-- ------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ------------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_admin_only"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------------
-- categories
-- ------------------------------------------------------------------
alter table public.categories enable row level security;

create policy "categories_select_public_active_or_admin"
  on public.categories for select
  using (active = true or public.is_admin());

create policy "categories_write_admin"
  on public.categories for insert
  with check (public.is_admin());

create policy "categories_update_admin"
  on public.categories for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "categories_delete_admin"
  on public.categories for delete
  using (public.is_admin());

-- ------------------------------------------------------------------
-- products
-- ------------------------------------------------------------------
alter table public.products enable row level security;

create policy "products_select_public_active_or_admin"
  on public.products for select
  using (status = 'active' or public.is_admin());

create policy "products_insert_admin"
  on public.products for insert
  with check (public.is_admin());

create policy "products_update_admin"
  on public.products for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "products_delete_admin"
  on public.products for delete
  using (public.is_admin());

-- ------------------------------------------------------------------
-- product_images
-- ------------------------------------------------------------------
alter table public.product_images enable row level security;

create policy "product_images_select_public_or_admin"
  on public.product_images for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.status = 'active'
    )
  );

create policy "product_images_write_admin"
  on public.product_images for insert
  with check (public.is_admin());

create policy "product_images_update_admin"
  on public.product_images for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "product_images_delete_admin"
  on public.product_images for delete
  using (public.is_admin());

-- ------------------------------------------------------------------
-- product_variants
-- ------------------------------------------------------------------
alter table public.product_variants enable row level security;

create policy "product_variants_select_public_or_admin"
  on public.product_variants for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.status = 'active'
    )
  );

create policy "product_variants_write_admin"
  on public.product_variants for insert
  with check (public.is_admin());

create policy "product_variants_update_admin"
  on public.product_variants for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "product_variants_delete_admin"
  on public.product_variants for delete
  using (public.is_admin());

-- ------------------------------------------------------------------
-- banners
-- ------------------------------------------------------------------
alter table public.banners enable row level security;

create policy "banners_select_public_active_or_admin"
  on public.banners for select
  using (active = true or public.is_admin());

create policy "banners_write_admin"
  on public.banners for insert
  with check (public.is_admin());

create policy "banners_update_admin"
  on public.banners for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "banners_delete_admin"
  on public.banners for delete
  using (public.is_admin());

-- ------------------------------------------------------------------
-- site_settings — single row, always publicly readable
-- ------------------------------------------------------------------
alter table public.site_settings enable row level security;

create policy "site_settings_select_public"
  on public.site_settings for select
  using (true);

create policy "site_settings_write_admin"
  on public.site_settings for insert
  with check (public.is_admin());

create policy "site_settings_update_admin"
  on public.site_settings for update
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------------
-- customers
-- ------------------------------------------------------------------
alter table public.customers enable row level security;

create policy "customers_select_own_or_admin"
  on public.customers for select
  using (id = auth.uid() or public.is_admin());

create policy "customers_insert_own_or_admin"
  on public.customers for insert
  with check (id = auth.uid() or public.is_admin());

create policy "customers_update_own_or_admin"
  on public.customers for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy "customers_delete_admin"
  on public.customers for delete
  using (public.is_admin());

-- ------------------------------------------------------------------
-- addresses
-- ------------------------------------------------------------------
alter table public.addresses enable row level security;

create policy "addresses_select_own_or_admin"
  on public.addresses for select
  using (customer_id = auth.uid() or public.is_admin());

create policy "addresses_insert_own_or_admin"
  on public.addresses for insert
  with check (customer_id = auth.uid() or public.is_admin());

create policy "addresses_update_own_or_admin"
  on public.addresses for update
  using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

create policy "addresses_delete_own_or_admin"
  on public.addresses for delete
  using (customer_id = auth.uid() or public.is_admin());

-- ------------------------------------------------------------------
-- orders
-- ------------------------------------------------------------------
alter table public.orders enable row level security;

create policy "orders_select_own_or_admin"
  on public.orders for select
  using (customer_id = auth.uid() or public.is_admin());

create policy "orders_insert_own_or_admin"
  on public.orders for insert
  with check (customer_id = auth.uid() or public.is_admin());

create policy "orders_update_admin"
  on public.orders for update
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------------
-- order_items — access follows the parent order
-- ------------------------------------------------------------------
alter table public.order_items enable row level security;

create policy "order_items_select_own_or_admin"
  on public.order_items for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.customer_id = auth.uid()
    )
  );

create policy "order_items_insert_own_or_admin"
  on public.order_items for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.customer_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------
-- coupons — never exposed row-by-row to shoppers; validated through
-- the public.validate_coupon() function instead (see 0003_functions.sql)
-- ------------------------------------------------------------------
alter table public.coupons enable row level security;

create policy "coupons_select_admin"
  on public.coupons for select
  using (public.is_admin());

create policy "coupons_write_admin"
  on public.coupons for insert
  with check (public.is_admin());

create policy "coupons_update_admin"
  on public.coupons for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "coupons_delete_admin"
  on public.coupons for delete
  using (public.is_admin());
