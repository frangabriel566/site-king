PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_product_sections` (
	`product_id` text NOT NULL,
	`section` text NOT NULL,
	`position` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`product_id`, `section`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "product_sections_section_check" CHECK("__new_product_sections"."section" in ('lancamentos', 'novidades', 'ofertas', 'mais_vendidos', 'kits')),
	CONSTRAINT "product_sections_position_check" CHECK("__new_product_sections"."position" is null or "__new_product_sections"."position" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_product_sections`("product_id", "section", "position", "created_at") SELECT "product_id", "section", "position", "created_at" FROM `product_sections`;--> statement-breakpoint
DROP TABLE `product_sections`;--> statement-breakpoint
ALTER TABLE `__new_product_sections` RENAME TO `product_sections`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `product_sections_section_idx` ON `product_sections` (`section`,`position`);