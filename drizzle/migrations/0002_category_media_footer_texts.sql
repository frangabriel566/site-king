ALTER TABLE `categories` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `categories` ADD `size_guide` text;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `footer_payment_text` text;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `footer_security_text` text;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `footer_privacy_text` text;--> statement-breakpoint
-- Os três textos que o rodapé já mostrava, escritos no código até aqui.
-- Continuam iguais depois do deploy; apagar um em Configurações → Rodapé
-- o tira do site.
UPDATE `site_settings` SET `footer_payment_text` = 'Cartão, Pix e boleto', `footer_security_text` = 'Compra segura', `footer_privacy_text` = 'Dados protegidos' WHERE `id` = 1;
