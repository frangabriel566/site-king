-- Feedbacks de clientes publicados pelo painel (Admin → Feedbacks): texto,
-- fotos/prints da conversa, ou os dois. Só tabelas novas; nenhum dado
-- existente muda. O produto vinculado fica vazio se o produto for excluído;
-- as imagens saem junto com o feedback.
CREATE TABLE `feedback_images` (
	`id` text PRIMARY KEY NOT NULL,
	`feedback_id` text NOT NULL,
	`url` text NOT NULL,
	`kind` text DEFAULT 'photo' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`width` integer,
	`height` integer,
	FOREIGN KEY (`feedback_id`) REFERENCES `feedbacks`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "feedback_images_kind_check" CHECK("feedback_images"."kind" in ('photo', 'chat'))
);
--> statement-breakpoint
CREATE INDEX `feedback_images_feedback_idx` ON `feedback_images` (`feedback_id`,`position`);--> statement-breakpoint
CREATE TABLE `feedbacks` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_name` text NOT NULL,
	`customer_location` text,
	`text` text,
	`rating` integer,
	`product_id` text,
	`show_on_home` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`position` integer,
	`feedback_date` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "feedbacks_rating_check" CHECK("feedbacks"."rating" is null or "feedbacks"."rating" between 1 and 5),
	CONSTRAINT "feedbacks_position_check" CHECK("feedbacks"."position" is null or "feedbacks"."position" >= 1)
);
--> statement-breakpoint
CREATE INDEX `feedbacks_home_idx` ON `feedbacks` (`active`,`show_on_home`,`position`);--> statement-breakpoint
CREATE INDEX `feedbacks_product_idx` ON `feedbacks` (`product_id`,`active`);