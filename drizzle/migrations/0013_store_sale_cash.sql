-- Vendas na loja: valor recebido e troco no pagamento em dinheiro.
--
-- - store_sales.cash_received: quanto o cliente entregou. O troco é esse
--   valor menos o total. Vazio no Pix/cartão e nas vendas já registradas.
-- Só uma coluna nova (vazia); nenhum dado existente muda.
ALTER TABLE `store_sales` ADD `cash_received` real;
