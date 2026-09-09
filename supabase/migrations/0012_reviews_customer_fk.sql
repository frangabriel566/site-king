-- King Store — 0012_reviews_customer_fk.sql
-- 0011_reviews.sql pointed reviews.customer_id at public.customers, which
-- only gets a row once a shopper completes the customer signup form — an
-- admin account (or any other authenticated user without one) hit a
-- foreign key violation just trying to leave a review. Repoint it at
-- auth.users, the same table profiles.id already references, so any
-- signed-in visitor can review. The storefront looks up the reviewer's
-- display name from customers separately (see lib/data/reviews.ts) and
-- falls back to a generic label when there isn't one.

alter table public.reviews
  drop constraint reviews_customer_id_fkey;

alter table public.reviews
  add constraint reviews_customer_id_fkey
  foreign key (customer_id) references auth.users (id) on delete cascade;
