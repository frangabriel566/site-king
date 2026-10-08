-- Frete do pedido: cobrado, grátis ou "a combinar" pelo WhatsApp
-- (lib/shipping-mode.ts). Até aqui um pedido com frete 0 aparecia como
-- "Grátis" mesmo quando o frete ainda ia ser combinado na conversa.
--
-- Pedidos antigos:
-- - com código KS (compra pelo WhatsApp, frete sempre 0): "grátis" se o
--   cupom usado zera o frete, senão "a combinar";
-- - do checkout com frete 0: "grátis" (regra da loja ou cupom);
-- - do checkout com frete cobrado: continuam "cobrado" (o padrão).
-- Nenhum valor muda: só a coluna nova é preenchida.
ALTER TABLE `orders` ADD `shipping_mode` text DEFAULT 'charged' NOT NULL;
--> statement-breakpoint
UPDATE `orders` SET `shipping_mode` = CASE
    WHEN EXISTS (
      SELECT 1 FROM `coupons`
      WHERE `coupons`.`code` = `orders`.`coupon_code` AND `coupons`.`free_shipping` = 1
    ) THEN 'free'
    ELSE 'to_agree'
  END
WHERE `code` IS NOT NULL AND `shipping` = 0;
--> statement-breakpoint
UPDATE `orders` SET `shipping_mode` = 'free'
WHERE `code` IS NULL AND `shipping` = 0;
