ALTER TABLE `banners` ADD `kind` text DEFAULT 'editavel' NOT NULL;--> statement-breakpoint
ALTER TABLE `banners` ADD `mobile_image_url` text;--> statement-breakpoint
ALTER TABLE `banners` ADD `eyebrow_highlight` text;--> statement-breakpoint
ALTER TABLE `banners` ADD `subtitle` text;--> statement-breakpoint
ALTER TABLE `banners` ADD `whatsapp_label` text;--> statement-breakpoint
ALTER TABLE `banners` ADD `show_whatsapp` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `banners` ADD `badge` text;--> statement-breakpoint
ALTER TABLE `banners` ADD `style` text;--> statement-breakpoint
-- The old banners only fed the photo of the previous hero; as full-screen
-- banners they would show their old texts, so they start switched off.
UPDATE `banners` SET `active` = 0;
