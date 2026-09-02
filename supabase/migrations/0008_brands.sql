-- King Store — 0008_brands.sql
-- Brands as a managed entity (not free text), plus a small set of
-- product fields the new retail product page needs: a manufacturer
-- reference, a flexible spec sheet, and a promo badge.
--
-- brand_id is `on delete set null` — deleting a brand must never delete
-- its products, exactly like products.category_id already works. See
-- 0002_rls.sql's categories block, which this mirrors.

-- ------------------------------------------------------------------
-- brands
-- ------------------------------------------------------------------
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  description text,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index brands_active_position_idx on public.brands (active, position);

alter table public.brands enable row level security;

create policy "brands_select_public_active_or_admin"
  on public.brands for select
  using (active = true or public.is_admin());

create policy "brands_write_admin"
  on public.brands for insert
  with check (public.is_admin());

create policy "brands_update_admin"
  on public.brands for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "brands_delete_admin"
  on public.brands for delete
  using (public.is_admin());

-- ------------------------------------------------------------------
-- products — brand link + retail product-page fields
-- ------------------------------------------------------------------
alter table public.products
  add column brand_id uuid references public.brands (id) on delete set null,
  add column manufacturer_ref text,
  add column attributes jsonb,
  add column badge text check (badge is null or badge in ('lancamento', 'oferta'));

create index products_brand_id_idx on public.products (brand_id);
