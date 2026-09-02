-- King Store — 0009_product_fields.sql
-- Fields for the reworked product admin form: short/long description split,
-- optional video, tags, a lightweight collection label, per-product
-- shipping/exchange/care copy (falls back to the site-wide site_settings
-- values when null), and a per-color photo on variants.
--
-- Deliberately NOT added: weight/dimensions on variants already exist
-- (0006_variant_logistics.sql) and are left untouched — the new product
-- form simply stops surfacing and requiring them.

alter table public.products
  add column short_description text,
  add column video_url text,
  add column tags text[],
  add column collection text,
  add column shipping_note text,
  add column exchange_info text,
  add column care_instructions text;

alter table public.product_variants
  add column image_url text;
