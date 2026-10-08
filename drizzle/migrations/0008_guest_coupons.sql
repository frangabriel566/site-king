-- Cupom para visitante (Etapa 1).
--
-- - rate_limits: tentativas de cupom que falharam, por cliente e minuto
--   (a chave é um hash, nunca o IP).
-- - coupons.one_per_phone: um uso por telefone (avisa, não bloqueia).
-- - orders.customer_phone: telefone do cliente, digitado pela loja ao
--   confirmar a venda.
-- - orders.coupon_used_at: quando o uso do cupom deste pedido foi contado.
--
-- O uso do cupom passa a contar só na confirmação (ou no pagamento). Antes
-- contava na criação do pedido, então pedidos aguardando WhatsApp seguravam
-- usos. Pedidos já confirmados ganham coupon_used_at, e used_count é
-- recontado só com eles: os usos presos em pedidos pendentes voltam.
-- Valores de pedidos não mudam.
CREATE TABLE `rate_limits` (
	`key` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`key`, `window_start`)
);
--> statement-breakpoint
ALTER TABLE `coupons` ADD `one_per_phone` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `coupon_used_at` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `customer_phone` text;--> statement-breakpoint
CREATE INDEX `orders_coupon_phone_idx` ON `orders` (`coupon_code`,`customer_phone`);
--> statement-breakpoint
UPDATE `orders` SET `coupon_used_at` = coalesce(`updated_at`, `created_at`)
WHERE `coupon_code` IS NOT NULL
  AND `status` IN ('paid', 'processing', 'shipped', 'delivered');
--> statement-breakpoint
UPDATE `coupons` SET `used_count` = min(
  (SELECT count(*) FROM `orders`
    WHERE `orders`.`coupon_code` = `coupons`.`code` AND `orders`.`coupon_used_at` IS NOT NULL),
  coalesce(`max_uses`, 1000000000)
);
