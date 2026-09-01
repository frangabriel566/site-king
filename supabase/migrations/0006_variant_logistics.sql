-- King Store — 0006_variant_logistics.sql
-- Per-variant logistics data (weight varies by size, so this lives on
-- product_variants, not products). Nullable at the database level —
-- required only to *publish* a product, enforced in the app layer
-- (lib/validations/product.ts publishableProductSchema), not by a
-- NOT NULL/CHECK constraint, so drafts can still be saved incomplete.

alter table public.product_variants
  add column weight_grams int null,
  add column length_cm numeric(6, 2) null,
  add column width_cm numeric(6, 2) null,
  add column height_cm numeric(6, 2) null;

alter table public.product_variants
  add constraint product_variants_weight_grams_check
    check (weight_grams is null or weight_grams > 0),
  add constraint product_variants_length_cm_check
    check (length_cm is null or length_cm > 0),
  add constraint product_variants_width_cm_check
    check (width_cm is null or width_cm > 0),
  add constraint product_variants_height_cm_check
    check (height_cm is null or height_cm > 0);
