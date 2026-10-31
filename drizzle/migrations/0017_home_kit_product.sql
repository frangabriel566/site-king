ALTER TABLE `home_settings` ADD `kit_product_id` text REFERENCES products(id) ON DELETE set null;
