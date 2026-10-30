CREATE TABLE `home_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`eyebrow` text,
	`eyebrow_highlight` text,
	`headline` text,
	`headline_highlight` text,
	`subtitle` text,
	`cta_label` text,
	`cta_href` text,
	`whatsapp_label` text,
	`featured_product_id` text,
	`featured_label` text,
	FOREIGN KEY (`featured_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "home_settings_single_row" CHECK("home_settings"."id" = 1)
);
