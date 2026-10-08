-- Variações retiradas de um produto no painel deixam de ser apagadas quando
-- algum pedido aponta para elas: ficam arquivadas (archived_at), invisíveis na
-- loja e no painel, e os pedidos continuam ligados a elas. Nenhum dado muda
-- aqui; o religamento dos itens já desligados é um script à parte
-- (scripts/sql/relink-order-items.sql), rodado só depois do deploy.
ALTER TABLE `product_variants` ADD `archived_at` text;