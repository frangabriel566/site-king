-- Cupons: início da validade, limite e contagem de usos, frete grátis e
-- data de criação. A tabela é recriada porque o SQLite não acrescenta
-- CHECK a uma tabela existente, e é o CHECK `coupons_usage_check` que
-- impede dois pedidos simultâneos de passarem do limite de usos.
-- Nenhuma tabela tem chave estrangeira para `coupons`, então recriar é
-- seguro (orders.coupon_code guarda o código como texto).
CREATE TABLE `__new_coupons` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`type` text NOT NULL,
	`value` real NOT NULL,
	`min_total` real DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`starts_at` text,
	`expires_at` text,
	`max_uses` integer,
	`used_count` integer DEFAULT 0 NOT NULL,
	`free_shipping` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "coupons_type_check" CHECK("type" in ('percent', 'fixed')),
	CONSTRAINT "coupons_value_check" CHECK("value" >= 0),
	CONSTRAINT "coupons_usage_check" CHECK("used_count" >= 0 and ("max_uses" is null or "used_count" <= "max_uses"))
);
--> statement-breakpoint
-- Os códigos passam a ser guardados sempre em maiúsculas e sem espaços.
-- `expires_at` fica só com a data (já era assim pelo painel).
INSERT INTO `__new_coupons`("id", "code", "type", "value", "min_total", "active", "expires_at")
SELECT "id", upper(replace(trim("code"), ' ', '')), "type", "value", "min_total", "active", substr("expires_at", 1, 10) FROM `coupons`;
--> statement-breakpoint
DROP TABLE `coupons`;--> statement-breakpoint
ALTER TABLE `__new_coupons` RENAME TO `coupons`;--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_code_unique` ON `coupons` (`code`);--> statement-breakpoint
ALTER TABLE `orders` ADD `coupon_code` text;
