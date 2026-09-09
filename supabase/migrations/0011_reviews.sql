-- King Store — 0011_reviews.sql
-- Product reviews: a logged-in customer leaves one rating (1-5) and an
-- optional comment per product. One row per (product, customer) — the
-- unique constraint doubles as "one review per customer" and lets a
-- resubmission overwrite it (upsert) instead of piling up duplicates.
--
-- Reviews are public read (the storefront shows them, and the average
-- rating, to anonymous visitors) but only the author can write their own
-- row; admins can delete any review for basic moderation, mirroring how
-- 0002_rls.sql's addresses/orders blocks grant an admin override.

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (product_id, customer_id)
);

create index reviews_product_id_idx on public.reviews (product_id);

alter table public.reviews enable row level security;

create policy "reviews_select_public"
  on public.reviews for select
  using (true);

create policy "reviews_insert_own"
  on public.reviews for insert
  with check (customer_id = auth.uid());

create policy "reviews_update_own"
  on public.reviews for update
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

create policy "reviews_delete_own_or_admin"
  on public.reviews for delete
  using (customer_id = auth.uid() or public.is_admin());
