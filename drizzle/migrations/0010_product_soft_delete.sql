-- Imagens no KV (Etapa 4): exclusão de produto que já foi vendido.
--
-- - products.deleted_at: o produto excluído no painel que tem pedidos fica
--   no banco, arquivado, para os pedidos continuarem ligados a ele. Some do
--   site e do painel; o slug é liberado para um produto novo.
-- Só uma coluna nova (vazia); nenhum dado existente muda.
ALTER TABLE `products` ADD `deleted_at` text;
