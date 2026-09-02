-- King Store — 0010_placement_badge.sql
-- Extends the product "badge" enum with a third value, 'mais_vendido', so a
-- single admin control can place a product on any of the home page's four
-- rails: Lançamentos -> 'lancamento', Mais vendidos -> 'mais_vendido',
-- Ofertas -> 'oferta'. "Produtos" needs no new value — it's simply
-- badge is null, the existing catalog default that already lists every
-- active product regardless of badge.
--
-- Pure widening of the existing check constraint (drop + recreate by its
-- Postgres-assigned default name from 0008_brands.sql); no data is
-- touched, and every row currently satisfying the 2-value constraint still
-- satisfies the 3-value one.

alter table public.products
  drop constraint if exists products_badge_check;

alter table public.products
  add constraint products_badge_check
  check (badge is null or badge in ('lancamento', 'oferta', 'mais_vendido'));
