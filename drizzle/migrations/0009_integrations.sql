-- Integrações (Etapa 2): Mercado Pago e Melhor Envio configurados no painel.
--
-- - integrations: uma linha por serviço, com os tokens criptografados (a
--   chave fica no secret INTEGRATIONS_KEY, nunca no banco), os 4 últimos
--   caracteres para mostrar, o ambiente, se está ativo e o último teste.
-- - integration_log: quem mudou o quê e quando, sem os valores.
-- - site_settings: a versão "vendas pelo WhatsApp" dos textos de pagamento
--   (compra segura e rodapé). As versões atuais passam a valer só com
--   pagamento online.
-- Só tabelas e colunas novas; nenhum dado existente muda.
CREATE TABLE `integration_log` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`action` text NOT NULL,
	`actor_email` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `integration_log_created_at_idx` ON `integration_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `integrations` (
	`provider` text PRIMARY KEY NOT NULL,
	`environment` text DEFAULT 'test' NOT NULL,
	`secrets` text,
	`hints` text,
	`options` text,
	`active` integer DEFAULT false NOT NULL,
	`test_ok` integer DEFAULT false NOT NULL,
	`tested_at` text,
	`test_message` text,
	`updated_at` text,
	`updated_by` text,
	CONSTRAINT "integrations_provider_check" CHECK("integrations"."provider" in ('mercadopago', 'melhorenvio')),
	CONSTRAINT "integrations_environment_check" CHECK("integrations"."environment" in ('test', 'production'))
);
--> statement-breakpoint
ALTER TABLE `site_settings` ADD `secure_purchase_note_whatsapp` text;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `footer_payment_text_whatsapp` text;
