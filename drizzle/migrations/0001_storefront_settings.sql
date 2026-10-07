ALTER TABLE `site_settings` ADD `installments_max` integer;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `pix_discount_percent` real;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `free_shipping_threshold` real;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `new_product_days` integer;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `low_stock_units` integer;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `exchange_note` text;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `secure_purchase_note` text;--> statement-breakpoint
-- Keeps the two rules that were hard-coded until now: checkout shipped free
-- from R$ 399 (lib/constants FREE_SHIPPING_THRESHOLD) and the card said
-- "Últimas unidades" at 3 pieces or fewer. Everything else starts empty.
UPDATE `site_settings` SET `free_shipping_threshold` = 399, `low_stock_units` = 3 WHERE `id` = 1;
