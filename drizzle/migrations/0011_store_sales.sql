-- Vendas na loja física: baixa no estoque das peças vendidas no balcão.
--
-- - store_sales / store_sale_items: as vendas da loja e suas peças, fora
--   da tabela de pedidos do site, para os dois valores nunca se misturarem.
--   "Desfazer baixa" marca canceled_at e devolve as peças ao estoque.
-- - store_customers: o cadastro de clientes da loja (nome; telefone e
--   aniversário opcionais), para a lista de aniversariantes.
-- - store_settings: o texto da mensagem de aniversário.
-- Só tabelas novas; nenhum dado existente muda.
--
-- Divide o número 0011 com 0011_product_sections_kits (feitas em paralelo)
-- e já foi aplicada em produção com este nome, que o D1 usa para saber o
-- que já rodou — por isso não foi renomeada. No journal do Drizzle ela é
-- a entrada 12 (snapshot 0012), depois da de kits.
CREATE TABLE `store_customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`birthdate` text,
	`birthday_sent_year` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_customers_phone_idx` ON `store_customers` (`phone`) WHERE "store_customers"."phone" is not null;--> statement-breakpoint
CREATE INDEX `store_customers_name_idx` ON `store_customers` (`name`);--> statement-breakpoint
CREATE TABLE `store_sale_items` (
	`id` text PRIMARY KEY NOT NULL,
	`sale_id` text NOT NULL,
	`product_id` text,
	`variant_id` text,
	`name` text NOT NULL,
	`color` text,
	`size` text,
	`unit_price` real NOT NULL,
	`qty` integer NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `store_sales`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "store_sale_items_qty_check" CHECK("store_sale_items"."qty" > 0),
	CONSTRAINT "store_sale_items_unit_price_check" CHECK("store_sale_items"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE INDEX `store_sale_items_sale_id_idx` ON `store_sale_items` (`sale_id`);--> statement-breakpoint
CREATE INDEX `store_sale_items_product_id_idx` ON `store_sale_items` (`product_id`);--> statement-breakpoint
CREATE TABLE `store_sales` (
	`id` text PRIMARY KEY NOT NULL,
	`sale_number` integer NOT NULL,
	`customer_id` text,
	`customer_name` text,
	`payment_method` text NOT NULL,
	`subtotal` real NOT NULL,
	`discount` real DEFAULT 0 NOT NULL,
	`total` real NOT NULL,
	`note` text,
	`created_by` text,
	`canceled_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `store_customers`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "store_sales_payment_method_check" CHECK("store_sales"."payment_method" in ('dinheiro', 'pix', 'debito', 'credito', 'outro')),
	CONSTRAINT "store_sales_amounts_check" CHECK("store_sales"."subtotal" >= 0 and "store_sales"."discount" >= 0 and "store_sales"."discount" <= "store_sales"."subtotal" and "store_sales"."total" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_sales_sale_number_unique` ON `store_sales` (`sale_number`);--> statement-breakpoint
CREATE INDEX `store_sales_created_at_idx` ON `store_sales` (`created_at`);--> statement-breakpoint
CREATE INDEX `store_sales_customer_id_idx` ON `store_sales` (`customer_id`);--> statement-breakpoint
CREATE TABLE `store_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`birthday_message` text,
	CONSTRAINT "store_settings_single_row" CHECK("store_settings"."id" = 1)
);
