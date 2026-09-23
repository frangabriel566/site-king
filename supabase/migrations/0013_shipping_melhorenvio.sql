-- King Store — 0013_shipping_melhorenvio.sql
-- Everything the Melhor Envio integration needs: what a parcel weighs and
-- measures, where it ships from, and what came back when a label was bought.

-- ------------------------------------------------------------------
-- products — package spec
-- ------------------------------------------------------------------
-- 0006 put these same four fields on product_variants, reasoning that
-- weight varies by size. Nothing ever read or wrote them — no form, no
-- query, no validation — so they stayed null on every row, and a freight
-- quote needs a number it can actually count on. They live here instead:
-- one spec per product is what the admin is asked for, what apparel
-- actually needs, and one source of truth for the quote to read. The
-- columns on product_variants are now dead; dropping them is a separate,
-- destructive migration and is deliberately not done here.
--
-- Nullable, like 0006: a draft can be saved incomplete. What changes is
-- that publishing now demands them (publishableProductSchema), because a
-- published product with no weight is a product that cannot be sold.
alter table public.products
  add column weight_grams int null,
  add column length_cm numeric(6, 2) null,
  add column width_cm numeric(6, 2) null,
  add column height_cm numeric(6, 2) null;

alter table public.products
  add constraint products_weight_grams_check
    check (weight_grams is null or weight_grams > 0),
  add constraint products_length_cm_check
    check (length_cm is null or length_cm > 0),
  add constraint products_width_cm_check
    check (width_cm is null or width_cm > 0),
  add constraint products_height_cm_check
    check (height_cm is null or height_cm > 0);

-- ------------------------------------------------------------------
-- site_settings — where parcels ship from
-- ------------------------------------------------------------------
-- Melhor Envio needs a full sender for a label, not just a CEP. Name,
-- e-mail and phone are already on this table (store_name / email /
-- whatsapp) and are reused rather than duplicated; what is missing is the
-- address itself and the CPF/CNPJ, which the carrier requires on the
-- declaration and which has no other home in this schema.
alter table public.site_settings
  add column origin_document text,
  add column origin_cep text,
  add column origin_street text,
  add column origin_number text,
  add column origin_complement text,
  add column origin_district text,
  add column origin_city text,
  add column origin_state text;

-- ------------------------------------------------------------------
-- orders — what the carrier gave back
-- ------------------------------------------------------------------
-- `tracking_code` already exists and stays the one place a tracking code
-- lives, whether it came from Melhor Envio or was typed in by hand.
--   shipping_service       "PAC", "SEDEX", ".Package" — what the shopper chose
--   melhorenvio_order_id   the cart/order id on their side; also the
--                          idempotency key, so pressing the button twice
--                          cannot buy two labels for one order
--   label_url              the printable PDF, once it has been paid for
alter table public.orders
  add column shipping_service text,
  add column melhorenvio_order_id text,
  add column label_url text;

create unique index orders_melhorenvio_order_id_idx
  on public.orders (melhorenvio_order_id)
  where melhorenvio_order_id is not null;
